import type { SupabaseClient } from "@supabase/supabase-js";
import { geminiConfigured, geminiEvaluate, queueCaption } from "./gemini";
import { getMlApp, getMlToken, searchMl, mlGet } from "./ml";
import { publishDue } from "./publisher";
import { upcomingSlots } from "./schedule";
import { tgGetMe } from "./telegram";
import { isValidUrl } from "./utils";

export type Step = { name: string; status: "ok" | "skipped" | "blocked" | "error"; message: string };
export type Settings = {
  post_times: string[]; weekdays: number[]; run_time: string; max_posts_per_day: number; max_products_per_run: number;
  approval_mode: "manual" | "auto"; min_score: number; search_terms: string[]; ai_daily_limit: number; last_run_at: string | null; last_tick_at: string | null;
};

export async function ensureSettings(db: SupabaseClient, userId: string): Promise<Settings> {
  const { data } = await db.from("automation_settings").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as Settings;
  const { data: created } = await db.from("automation_settings").upsert({ user_id: userId }).select("*").single();
  return created as Settings;
}

/** Rotina completa: conexões → coleta → IA → aprovação → fila → publicação. Nunca simula sucesso. */
export async function runPipeline(db: SupabaseClient, userId: string, kind: "daily" | "manual"): Promise<{ steps: Step[]; status: "ok" | "partial" | "failed" }> {
  const steps: Step[] = [];
  const { data: run } = await db.from("automation_runs").insert({ user_id: userId, kind }).select("id").single();
  const s = await ensureSettings(db, userId);
  const { data: prof } = await db.from("profiles").select("timezone").eq("id", userId).maybeSingle();
  const tz = prof?.timezone ?? "America/Sao_Paulo";
  const add = (name: string, status: Step["status"], message: string) => steps.push({ name, status, message });

  try {
    // 1. Conexões ------------------------------------------------------------------------
    const { data: bot } = await db.from("telegram_bot").select("bot_token").eq("user_id", userId).maybeSingle();
    let tgOk = false;
    if (!bot) add("Telegram", "blocked", "Bot não configurado (Canais → Bot do Telegram).");
    else {
      const me = await tgGetMe(bot.bot_token);
      tgOk = me.ok;
      add("Telegram", me.ok ? "ok" : "error", me.ok ? `Bot @${me.result.username} respondeu.` : `Token recusado: ${me.error}`);
    }
    let mlToken: string | null = null;
    if (!(await getMlApp(db, userId))) add("Mercado Livre", "skipped", "Aplicação não configurada.");
    else {
      try {
        mlToken = await getMlToken(db, userId);
        if (!mlToken) add("Mercado Livre", "skipped", "Não conectado.");
        else {
          const me = await mlGet(mlToken, "/users/me");
          add("Mercado Livre", me.ok ? "ok" : "error", me.ok ? "Conta conectada." : `Mercado Livre respondeu ${me.status}.`);
          if (!me.ok) mlToken = null;
        }
      } catch (e: any) { add("Mercado Livre", "error", e?.message ?? "Falha ao verificar."); mlToken = null; }
    }
    add("Gemini", geminiConfigured() ? "ok" : "blocked", geminiConfigured() ? "Chave configurada no servidor." : "GEMINI_API_KEY não configurada na Vercel.");

    // 2. Coleta (somente por API oficial; sem simular) -------------------------------------
    if (!s.search_terms.length) add("Coleta", "skipped", "Nenhum termo de busca configurado. Produtos entram pelo botão roxo ou por Buscar/Novo produto.");
    else if (!mlToken) add("Coleta", "skipped", "Mercado Livre não está conectado.");
    else {
      let saved = 0; let blocked: string | null = null;
      for (const term of s.search_terms) {
        if (saved >= s.max_products_per_run) break;
        const r = await searchMl(mlToken, term);
        if ("error" in r) { blocked = r.error; break; }
        for (const it of r.items) {
          if (saved >= s.max_products_per_run) break;
          const { data: dup } = await db.from("products").select("id").eq("user_id", userId).or(`original_url.eq.${it.permalink},external_id.eq.${it.id}`).limit(1);
          if (dup?.length) continue;
          const { error } = await db.from("products").insert({
            user_id: userId, marketplace: "mercadolivre", external_id: it.id, title: it.title, price: it.price,
            previous_price: it.original_price, image_url: it.image, original_url: it.permalink, free_shipping: it.free_shipping ? true : null,
            source: "api", status: "found", data_updated_at: new Date().toISOString(),
          });
          if (!error) saved++;
        }
      }
      if (blocked) add("Coleta", "blocked", `${blocked}. O Mercado Livre bloqueia a leitura de produtos para este app; nada foi coletado.`);
      else add("Coleta", "ok", `${saved} produto(s) novo(s) coletado(s).`);
    }

    // 3. IA --------------------------------------------------------------------------------
    if (!geminiConfigured()) add("IA", "blocked", "Sem GEMINI_API_KEY: nenhum produto foi avaliado.");
    else {
      const day = new Date().toISOString().slice(0, 10);
      const { data: u } = await db.from("ai_usage").select("calls").eq("user_id", userId).eq("day", day).maybeSingle();
      let calls = u?.calls ?? 0;
      const { data: todo } = await db.from("products").select("*").eq("user_id", userId).eq("status", "found").eq("is_demo", false)
        .is("ai_score", null).order("created_at", { ascending: true }).limit(s.max_products_per_run);
      let done = 0; let err: string | null = null; let limited = false;
      for (const p of (todo ?? []) as any[]) {
        if (calls >= s.ai_daily_limit) { limited = true; break; }
        calls++;
        await db.from("ai_usage").upsert({ user_id: userId, day, calls });
        try {
          const r = await geminiEvaluate({
            title: p.title, marketplace: p.marketplace, price: Number(p.price), previous_price: p.previous_price != null ? Number(p.previous_price) : null,
            coupon: p.coupon, free_shipping: p.free_shipping, shipping_info: p.shipping_info, category: p.category,
            rating: p.rating != null ? Number(p.rating) : null, has_image: !!p.image_url, has_affiliate_link: !!p.affiliate_url,
          });
          const patch: any = { ai_score: r.score, ai_notes: [r.notes, ...r.issues.map((x) => `• ${x}`)].filter(Boolean).join("\n"), ai_evaluated_at: new Date().toISOString() };
          if (!p.promo_text?.trim() && r.caption) patch.promo_text = r.caption;
          await db.from("products").update(patch).eq("id", p.id);
          done++;
        } catch (e: any) { err = e?.message ?? "Falha no Gemini."; break; }
      }
      if (err) add("IA", "error", `${done} avaliado(s). Parou: ${err}`);
      else add("IA", "ok", `${done} produto(s) avaliado(s)${limited ? ` (limite diário de ${s.ai_daily_limit} chamadas atingido)` : ""}.`);
    }

    // 4. Aprovação -------------------------------------------------------------------------
    if (s.approval_mode === "auto") {
      const { data: cand } = await db.from("products").select("id,affiliate_url,affiliate_verified,ai_score").eq("user_id", userId)
        .eq("status", "found").eq("is_demo", false).eq("affiliate_verified", true).gte("ai_score", s.min_score).limit(s.max_products_per_run);
      const ok = (cand ?? []).filter((p: any) => isValidUrl(p.affiliate_url));
      if (ok.length) await db.from("products").update({ status: "approved" }).in("id", ok.map((p: any) => p.id));
      add("Aprovação", "ok", `Modo automático: ${ok.length} produto(s) aprovado(s) (nota ≥ ${s.min_score} e link de afiliado confirmado).`);
    } else {
      const { count } = await db.from("products").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "found").eq("is_demo", false);
      add("Aprovação", "skipped", `Modo manual: ${count ?? 0} produto(s) aguardam a sua aprovação em Produtos.`);
    }

    // 5. Fila ------------------------------------------------------------------------------
    const { data: chans } = await db.from("channels").select("id,name").eq("user_id", userId).eq("type", "telegram").eq("enabled", true).eq("status", "connected");
    if (!chans?.length) add("Fila", "blocked", "Nenhum canal do Telegram conectado e ativo (Canais → Testar conexão).");
    else if (!tgOk) add("Fila", "blocked", "Telegram indisponível agora.");
    else {
      const { data: ready } = await db.from("products").select("*").eq("user_id", userId).eq("status", "approved").eq("is_demo", false)
        .eq("affiliate_verified", true).not("affiliate_url", "is", null)
        .order("ai_score", { ascending: false, nullsFirst: false }).order("created_at").limit(s.max_products_per_run);
      const prods = ((ready ?? []) as any[]).filter((p) => isValidUrl(p.affiliate_url));
      let queued = 0;
      if (prods.length) {
        const since = new Date(Date.now() - 36 * 3600_000).toISOString();
        for (const ch of chans as any[]) {
          const { data: occ } = await db.from("publish_queue").select("scheduled_for").eq("channel_id", ch.id)
            .in("status", ["pending", "sending", "sent"]).gte("scheduled_for", since);
          const slots = upcomingSlots({ now: new Date(), tz, times: s.post_times, weekdays: s.weekdays, perDay: s.max_posts_per_day, count: prods.length, taken: (occ ?? []).map((o: any) => new Date(o.scheduled_for)) });
          for (let i = 0; i < prods.length && i < slots.length; i++) {
            const p = prods[i];
            const caption = queueCaption(p);
            const { error } = await db.from("publish_queue").insert({ user_id: userId, product_id: p.id, channel_id: ch.id, scheduled_for: slots[i].toISOString(), caption });
            if (!error) { queued++; await db.from("products").update({ status: "queued" }).eq("id", p.id); }
          }
        }
      }
      add("Fila", "ok", prods.length ? `${queued} item(ns) agendado(s).` : "Nenhum produto aprovado com link de afiliado confirmado para enfileirar.");
    }

    // 6. Publicação (somente o que já venceu) -----------------------------------------------
    const pub = await publishDue(db, { userId });
    add("Publicação", pub.failed || pub.retry ? "error" : "ok", `${pub.sent} enviado(s), ${pub.retry} com nova tentativa, ${pub.failed} falha(s).${pub.messages.length ? " " + pub.messages.slice(0, 2).join(" | ") : ""}`);
  } catch (e: any) {
    add("Rotina", "error", e?.message ?? "Erro inesperado.");
  }

  const bad = steps.filter((x) => x.status === "error").length;
  const status = bad === 0 ? "ok" : bad === steps.length ? "failed" : "partial";
  if (run?.id) await db.from("automation_runs").update({ finished_at: new Date().toISOString(), status, steps }).eq("id", run.id);
  if (kind === "daily") await db.from("automation_settings").update({ last_run_at: new Date().toISOString() }).eq("user_id", userId);
  await db.from("activity_log").insert({ user_id: userId, action: `automation.run_${status}`, details: { title: kind === "daily" ? "Rotina diária" : "Execução manual" } });
  return { steps, status };
}
