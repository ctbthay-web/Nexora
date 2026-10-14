import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { ensureSettings } from "@/lib/automation";
import { fmtDate } from "@/lib/utils";
import { localParts } from "@/lib/schedule";
import { zonedToUtc } from "@/lib/utils";
import { geminiConfigured } from "@/lib/gemini";
import { publishPendingNow, runNow, saveAutomation, testGemini, toggleAutomationHere } from "./actions";

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const BADGE: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300", skipped: "bg-slate-500/15 text-muted",
  blocked: "bg-amber-500/15 text-amber-700 dark:text-amber-300", error: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  partial: "bg-amber-500/15 text-amber-700 dark:text-amber-300", failed: "bg-rose-500/15 text-rose-700 dark:text-rose-300", running: "bg-sky-500/15 text-sky-700",
};
const LBL: Record<string, string> = { ok: "OK", skipped: "Pulada", blocked: "Bloqueada", error: "Erro", partial: "Com avisos", failed: "Falhou", running: "Rodando" };

function nextDaily(tz: string, runTime: string, weekdays: number[]) {
  const now = new Date(); const st = localParts(now, tz);
  for (let i = 0; i < 8; i++) {
    const b = new Date(Date.UTC(st.y, st.m - 1, st.d + i, 12));
    if (!weekdays.includes(b.getUTCDay())) continue;
    const day = b.toISOString().slice(0, 10);
    const at = zonedToUtc(`${day}T${runTime}`, tz);
    if (at > now) return at;
  }
  return null;
}

export default async function AutomationPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase, user } = await requireUser();
  const s = await ensureSettings(supabase, user.id);
  const [{ data: prof }, { data: runs }, { data: nextQ }, { count: pend }, { count: awaiting }] = await Promise.all([
    supabase.from("profiles").select("timezone,automation_status").eq("id", user.id).single(),
    supabase.from("automation_runs").select("*").order("started_at", { ascending: false }).limit(5),
    supabase.from("publish_queue").select("scheduled_for").eq("status", "pending").order("scheduled_for").limit(1),
    supabase.from("publish_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("status", "found").eq("is_demo", false),
  ]);
  const tz = prof?.timezone ?? "America/Sao_Paulo";
  const running = prof?.automation_status === "running";
  const lastTick = s.last_tick_at ? new Date(s.last_tick_at) : null;
  const tickAlive = !!lastTick && Date.now() - lastTick.getTime() < 15 * 60_000;
  const env = { gemini: geminiConfigured(), service: !!process.env.SUPABASE_SERVICE_ROLE_KEY, cron: !!process.env.CRON_SECRET && process.env.CRON_SECRET.length >= 16 };
  const nd = nextDaily(tz, s.run_time, s.weekdays);
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Automação</h1>
      <Flash searchParams={searchParams} />

      <section className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-semibold">Automação: <span className={`badge ${running ? BADGE.ok : BADGE.skipped}`}>{running ? "ATIVA" : "PAUSADA"}</span></p>
            <p className="text-xs text-muted">Última rotina diária: {fmtDate(s.last_run_at, tz)} · Próxima rotina: {running && nd ? fmtDate(nd.toISOString(), tz) : "—"} · Próxima publicação: {running && nextQ?.[0] ? fmtDate(nextQ[0].scheduled_for, tz) : "—"}</p>
            <p className="text-xs text-muted">Na fila: {pend ?? 0} · Produtos aguardando aprovação: {awaiting ?? 0}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <form action={toggleAutomationHere}><SubmitButton className={running ? "btn" : "btn btn-primary"}>{running ? "Pausar automação" : "Iniciar automação"}</SubmitButton></form>
            <form action={runNow}><SubmitButton className="btn" confirm="Executa a rotina agora (IA, fila e envio do que já venceu). Continuar?">Executar rotina agora</SubmitButton></form>
            <form action={publishPendingNow}><SubmitButton className="btn" confirm="Publica agora, de verdade, tudo que já venceu na fila. Continuar?">Publicar vencidos agora</SubmitButton></form>
          </div>
        </div>
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="font-semibold">Pré-requisitos do servidor</h2>
        <ul className="space-y-1 text-xs">
          <li>{env.gemini ? "✅" : "❌"} <b>GEMINI_API_KEY</b> (Vercel){" "}<form action={testGemini} className="inline"><SubmitButton className="btn !py-0.5 !text-xs">Testar Gemini</SubmitButton></form></li>
          <li>{env.service ? "✅" : "❌"} <b>SUPABASE_SERVICE_ROLE_KEY</b> (Vercel): necessária para o agendador rodar sem você logada</li>
          <li>{env.cron ? "✅" : "❌"} <b>CRON_SECRET</b> (Vercel, mínimo 16 caracteres): protege a rota do agendador</li>
          <li>{tickAlive ? "✅" : "❌"} <b>Agendador do Supabase</b>: {tickAlive ? `último sinal ${fmtDate(s.last_tick_at, tz)}` : lastTick ? `sem sinal desde ${fmtDate(s.last_tick_at, tz)}` : "ainda nunca chamou o app (execute o arquivo 0006 no SQL Editor)"}</li>
        </ul>
        <p className="text-xs text-muted">Os valores das chaves nunca aparecem aqui. Só mostramos se existem.</p>
      </section>

      <form action={saveAutomation} className="card grid gap-3 md:grid-cols-2">
        <h2 className="font-semibold md:col-span-2">Programação</h2>
        <div><label className="label">Horários de publicação ({tz})</label><input name="post_times" defaultValue={s.post_times.join(", ")} className="input" placeholder="09:00, 13:00, 19:00" /></div>
        <div><label className="label">Horário da rotina diária (IA e fila)</label><input name="run_time" defaultValue={s.run_time} className="input" placeholder="07:00" /></div>
        <div className="md:col-span-2">
          <label className="label">Dias da semana</label>
          <div className="flex flex-wrap gap-3 text-sm">{DAYS.map((d, i) => <label key={d} className="flex items-center gap-1"><input type="checkbox" name="weekdays" value={i} defaultChecked={s.weekdays.includes(i)} /> {d}</label>)}</div>
        </div>
        <div><label className="label">Máx. de publicações por dia (por canal)</label><input name="max_posts_per_day" type="number" min={1} max={50} defaultValue={s.max_posts_per_day} className="input" /></div>
        <div><label className="label">Máx. de produtos processados por rotina</label><input name="max_products_per_run" type="number" min={1} max={50} defaultValue={s.max_products_per_run} className="input" /></div>
        <div>
          <label className="label">Aprovação</label>
          <select name="approval_mode" defaultValue={s.approval_mode} className="input">
            <option value="manual">Manual: só publica o que EU aprovar</option>
            <option value="auto">Automática: aprova nota alta com link de afiliado confirmado</option>
          </select>
        </div>
        <div><label className="label">Nota mínima da IA (modo automático)</label><input name="min_score" type="number" min={0} max={10} defaultValue={s.min_score} className="input" /></div>
        <div><label className="label">Limite diário de chamadas ao Gemini</label><input name="ai_daily_limit" type="number" min={0} max={500} defaultValue={s.ai_daily_limit} className="input" /></div>
        <div className="md:col-span-2"><label className="label">Links de produtos para acompanhar e termos de busca (um por linha)</label><textarea name="search_terms" rows={3} defaultValue={s.search_terms.join("\n")} className="input" placeholder={"https://www.mercadolivre.com.br/...\nhttps://shopee.com.br/...\nfone bluetooth"} /><p className="mt-1 text-xs text-muted">Linhas que começam com https:// são links de produtos: a rotina abre a página pública (usando o cookie salvo da loja, se houver) e cadastra os novos. As demais linhas são termos de busca: a rotina lê a página pública de resultados do Mercado Livre (com o cookie salvo, se houver), sem API. Se uma loja bloquear a leitura, a rotina avisa e nada é inventado.</p></div>
        <div className="md:col-span-2"><SubmitButton>Salvar programação</SubmitButton></div>
      </form>

      <section className="card space-y-3">
        <h2 className="font-semibold">Últimas execuções</h2>
        {(runs ?? []).length === 0 && <p className="text-sm text-muted">Nenhuma execução ainda.</p>}
        {(runs ?? []).map((r: any) => (
          <div key={r.id} className="space-y-1 border-t border-line pt-2 first:border-0 first:pt-0">
            <p className="text-sm font-medium">{fmtDate(r.started_at, tz)} · {r.kind === "daily" ? "rotina diária" : "manual"} <span className={`badge ${BADGE[r.status]}`}>{LBL[r.status]}</span></p>
            <ul className="space-y-0.5 text-xs">
              {(r.steps ?? []).map((st: any, n: number) => <li key={n}><span className={`badge ${BADGE[st.status]}`}>{LBL[st.status]}</span> <b>{st.name}:</b> <span className="text-muted">{st.message}</span></li>)}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
