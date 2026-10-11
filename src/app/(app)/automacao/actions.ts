"use server";
import { revalidatePath } from "next/cache";
import { go, logActivity, requireUser } from "@/lib/session";
import { ensureSettings, runPipeline } from "@/lib/automation";
import { geminiEvaluate, geminiConfigured } from "@/lib/gemini";
import { publishDue } from "@/lib/publisher";
import { isTime } from "@/lib/schedule";

const P = "/automacao";

export async function saveAutomation(formData: FormData) {
  const { supabase, user } = await requireUser();
  const times = String(formData.get("post_times") ?? "").split(/[\s,;]+/).filter(Boolean);
  if (!times.length || times.some((t) => !isTime(t))) go(P, "err", "Horários inválidos. Use o formato 09:00, 13:30, 19:00.");
  const runTime = String(formData.get("run_time") ?? "");
  if (!isTime(runTime)) go(P, "err", "Horário da rotina diária inválido (ex.: 07:00).");
  const weekdays = formData.getAll("weekdays").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  if (!weekdays.length) go(P, "err", "Marque pelo menos um dia da semana.");
  const num = (k: string, min: number, max: number) => {
    const n = Number(formData.get(k));
    if (!Number.isInteger(n) || n < min || n > max) go(P, "err", `Valor inválido em “${k}” (de ${min} a ${max}).`);
    return n;
  };
  const mode = String(formData.get("approval_mode"));
  if (mode !== "manual" && mode !== "auto") go(P, "err", "Modo de aprovação inválido.");
  const terms = String(formData.get("search_terms") ?? "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 20);
  if (terms.some((t) => t.length > 80)) go(P, "err", "Cada termo de busca pode ter até 80 caracteres.");
  await ensureSettings(supabase, user.id);
  const { error } = await supabase.from("automation_settings").update({
    post_times: [...new Set(times)].sort(), weekdays: [...new Set(weekdays)].sort(), run_time: runTime,
    max_posts_per_day: num("max_posts_per_day", 1, 50), max_products_per_run: num("max_products_per_run", 1, 50),
    approval_mode: mode, min_score: num("min_score", 0, 10), search_terms: terms, ai_daily_limit: num("ai_daily_limit", 0, 500),
    updated_at: new Date().toISOString(),
  }).eq("user_id", user.id);
  if (error) go(P, "err", error.message);
  await logActivity(supabase, user.id, "automation.settings_saved");
  revalidatePath(P);
  go(P, "ok", "Configuração da automação salva.");
}

export async function toggleAutomationHere() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from("profiles").select("automation_status").eq("id", user.id).single();
  const next = p?.automation_status === "running" ? "paused" : "running";
  const { error } = await supabase.from("profiles").update({ automation_status: next }).eq("id", user.id);
  if (error) go(P, "err", error.message);
  await logActivity(supabase, user.id, next === "running" ? "automation.resumed" : "automation.paused");
  revalidatePath(P);
  go(P, "ok", next === "running" ? "Automação ATIVA: o agendador do servidor passa a executar a rotina e as publicações." : "Automação PAUSADA: nada será publicado sozinho.");
}

export async function runNow() {
  const { supabase, user } = await requireUser();
  const r = await runPipeline(supabase, user.id, "manual");
  revalidatePath(P);
  go(P, r.status === "failed" ? "err" : "ok", `Execução ${r.status === "ok" ? "concluída" : r.status === "partial" ? "concluída com avisos" : "com falhas"}. Veja o detalhe de cada etapa abaixo.`);
}

export async function publishPendingNow() {
  const { supabase, user } = await requireUser();
  const r = await publishDue(supabase, { userId: user.id });
  revalidatePath(P);
  go(P, r.failed || r.retry ? "err" : "ok", `${r.sent} enviado(s) e confirmado(s); ${r.retry} para nova tentativa; ${r.failed} falha(s).${r.messages[0] ? " " + r.messages[0] : ""}`);
}

/** Teste real do Gemini com um produto de exemplo (não é salvo em lugar nenhum). */
export async function testGemini() {
  const { supabase, user } = await requireUser();
  if (!geminiConfigured()) go(P, "err", "GEMINI_API_KEY não está configurada na Vercel (Settings → Environment Variables).");
  try {
    const r = await geminiEvaluate({ title: "Produto de teste (exemplo)", marketplace: "mercadolivre", price: 100, previous_price: 150, coupon: null, free_shipping: null, shipping_info: null, category: "Teste", rating: null, has_image: true, has_affiliate_link: false });
    await logActivity(supabase, user.id, "gemini.test_ok", { title: "Gemini" });
    go(P, "ok", `Gemini respondeu de verdade (nota de exemplo ${r.score}/10).`);
  } catch (e: any) {
    if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e;
    await logActivity(supabase, user.id, "gemini.test_failed", { title: "Gemini" });
    go(P, "err", `Gemini: ${e?.message ?? "falha"}`);
  }
}
