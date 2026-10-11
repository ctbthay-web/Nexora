import type { SupabaseClient } from "@supabase/supabase-js";
import { tgSendPost } from "./telegram";

export type PublishSummary = { sent: number; failed: number; retry: number; skipped: number; messages: string[] };

const MAX_ATTEMPTS = 3;
const backoffMin = (attempt: number) => 5 * attempt * attempt; // 5, 20 min…

/**
 * Envia os itens da fila que já venceram. Só marca "enviado" quando o Telegram confirma com message_id.
 * - userId: restringe a um usuário (usado nas ações manuais, via RLS).
 * - ids: restringe a itens específicos e ignora o horário (botão "Enviar agora").
 * - respectPause: quando true, usuários com a automação pausada não são processados.
 */
export async function publishDue(db: SupabaseClient, opts: { userId?: string; ids?: string[]; respectPause?: boolean; limit?: number; now?: Date } = {}): Promise<PublishSummary> {
  const now = opts.now ?? new Date();
  const out: PublishSummary = { sent: 0, failed: 0, retry: 0, skipped: 0, messages: [] };

  // Recupera itens presos em "enviando" (queda no meio do envio): voltam para pendente.
  let stuck = db.from("publish_queue").update({ status: "pending", updated_at: now.toISOString() })
    .eq("status", "sending").lt("updated_at", new Date(now.getTime() - 10 * 60_000).toISOString());
  if (opts.userId) stuck = stuck.eq("user_id", opts.userId);
  await stuck;

  let q = db.from("publish_queue")
    .select("id,user_id,attempts,caption,scheduled_for,next_attempt_at,products(id,title,image_url),channels(id,type,destination,enabled,name)")
    .eq("status", "pending").order("scheduled_for", { ascending: true }).limit(opts.limit ?? 10);
  if (opts.userId) q = q.eq("user_id", opts.userId);
  if (opts.ids?.length) q = q.in("id", opts.ids);
  else q = q.lte("scheduled_for", now.toISOString()).or(`next_attempt_at.is.null,next_attempt_at.lte.${now.toISOString()}`);
  const { data: items, error } = await q;
  if (error) { out.messages.push(`Erro ao ler a fila: ${error.message}`); return out; }

  const paused = new Map<string, boolean>();
  const tokens = new Map<string, string | null>();
  for (const it of (items ?? []) as any[]) {
    const uid = it.user_id as string;
    if (opts.respectPause && !opts.ids) {
      if (!paused.has(uid)) {
        const { data: p } = await db.from("profiles").select("automation_status").eq("id", uid).maybeSingle();
        paused.set(uid, p?.automation_status !== "running");
      }
      if (paused.get(uid)) { out.skipped++; continue; }
    }
    // Reserva o item (evita envio duplo se duas execuções se cruzarem).
    const { data: claimed } = await db.from("publish_queue")
      .update({ status: "sending", updated_at: new Date().toISOString() }).eq("id", it.id).eq("status", "pending").select("id");
    if (!claimed?.length) { out.skipped++; continue; }

    const fail = async (msg: string, final: boolean, retryAt?: Date) => {
      const attempts = (it.attempts ?? 0) + 1;
      const isFinal = final || attempts >= MAX_ATTEMPTS;
      await db.from("publish_queue").update({
        status: isFinal ? "failed" : "pending", attempts, last_error: msg.slice(0, 500), updated_at: new Date().toISOString(),
        next_attempt_at: isFinal ? null : (retryAt ?? new Date(Date.now() + backoffMin(attempts) * 60_000)).toISOString(),
      }).eq("id", it.id);
      if (isFinal) { await db.from("products").update({ status: "failed" }).eq("id", it.products?.id); out.failed++; }
      else out.retry++;
      await db.from("activity_log").insert({ user_id: uid, action: isFinal ? "publish.failed" : "publish.retry", details: { title: it.products?.title, error: msg.slice(0, 200) } });
      out.messages.push(`${it.products?.title ?? "item"}: ${msg}`);
    };

    const ch = it.channels;
    if (!ch || ch.type !== "telegram") { await fail("Canal inexistente ou não é Telegram (só Telegram publica nesta versão).", true); continue; }
    if (!ch.enabled) { await fail("Canal desativado.", true); continue; }
    if (!ch.destination) { await fail("Canal sem destino (@canal ou ID).", true); continue; }
    if (!it.caption?.trim()) { await fail("Item sem legenda.", true); continue; }
    if (!tokens.has(uid)) {
      const { data: b } = await db.from("telegram_bot").select("bot_token").eq("user_id", uid).maybeSingle();
      tokens.set(uid, b?.bot_token ?? null);
    }
    const token = tokens.get(uid);
    if (!token) { await fail("Bot do Telegram não configurado (Canais → Bot do Telegram).", true); continue; }

    const r = await tgSendPost(token, ch.destination, it.caption, it.products?.image_url ?? null);
    if (r.ok && r.result?.message_id) {
      const t = new Date().toISOString();
      await db.from("publish_queue").update({
        status: "sent", sent_at: t, attempts: (it.attempts ?? 0) + 1, last_error: null, next_attempt_at: null,
        external_message_id: String(r.result.message_id), response: { telegram_message_id: r.result.message_id }, updated_at: t,
      }).eq("id", it.id);
      await db.from("products").update({ status: "published" }).eq("id", it.products?.id);
      await db.from("activity_log").insert({ user_id: uid, action: "publish.sent", details: { title: it.products?.title, channel: ch.name, message_id: r.result.message_id } });
      out.sent++;
    } else if (!r.ok) {
      const permanent = r.code === 400 || r.code === 401 || r.code === 403 || r.code === 404;
      if (permanent) await db.from("channels").update({ status: "needs_attention", last_error: r.error.slice(0, 300) }).eq("id", ch.id);
      await fail(r.error, permanent, r.retryAfter ? new Date(Date.now() + (r.retryAfter + 1) * 1000) : undefined);
    } else {
      await fail("O Telegram não confirmou o envio (sem message_id).", false);
    }
  }
  return out;
}
