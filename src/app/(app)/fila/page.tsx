import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { fmtDate } from "@/lib/utils";
import { cancelQueueItem, retryItem, saveQueueCaption, sendNow } from "./actions";

const LABEL: Record<string, [string, string]> = {
  pending: ["Pendente", "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300"],
  sending: ["Enviando", "bg-amber-500/15 text-amber-700 dark:text-amber-300"],
  sent: ["Enviado", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"],
  failed: ["Falhou", "bg-rose-500/15 text-rose-700 dark:text-rose-300"],
  canceled: ["Cancelado", "bg-slate-500/15 text-muted"],
};

export default async function QueuePage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase, user } = await requireUser();
  const [{ data: items }, { data: prof }] = await Promise.all([
    supabase.from("publish_queue").select("id,status,scheduled_for,attempts,last_error,caption,sent_at,external_message_id,next_attempt_at,products(title),channels(name,type)")
      .order("scheduled_for", { ascending: false }).limit(200),
    supabase.from("profiles").select("timezone,automation_status").eq("id", user.id).single(),
  ]);
  const tz = prof?.timezone ?? "America/Sao_Paulo";
  const running = prof?.automation_status === "running";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Fila de publicação</h1>
      <Flash searchParams={searchParams} />
      <p className="text-xs text-muted">
        {running ? "Automação ATIVA: itens pendentes são publicados sozinhos no horário (o agendador roda a cada 5 minutos)." : "Automação PAUSADA: nada é publicado sozinho. Você ainda pode usar “Enviar agora”."}
        {" "}Um item só vira “Enviado” quando o Telegram confirma. Falhas são tentadas até 3 vezes.
      </p>
      <div className="space-y-2">
        {(items ?? []).length === 0 && <div className="card text-sm text-muted">Fila vazia. Aprove um produto com link de afiliado confirmado e use “Enfileirar”, ou deixe a rotina diária fazer isso.</div>}
        {(items ?? []).map((i: any) => {
          const [lbl, cls] = LABEL[i.status] ?? [i.status, ""];
          return (
            <div key={i.id} className="card space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{i.products?.title} <span className={`badge ${cls}`}>{lbl}</span></p>
                  <p className="text-xs text-muted">
                    {i.channels?.name} ({i.channels?.type}) · agendado {fmtDate(i.scheduled_for, tz)}
                    {i.sent_at ? ` · enviado ${fmtDate(i.sent_at, tz)} (msg ${i.external_message_id})` : ""}
                    {i.status === "pending" && i.attempts > 0 ? ` · tentativa ${i.attempts}/3, próxima ${fmtDate(i.next_attempt_at, tz)}` : ""}
                  </p>
                  {i.last_error && <p className="text-xs text-rose-600">Erro: {i.last_error}</p>}
                </div>
                <div className="flex gap-2">
                  {i.status === "pending" && <form action={sendNow}><input type="hidden" name="id" value={i.id} /><SubmitButton className="btn" confirm="Publicar este item agora, de verdade?">Enviar agora</SubmitButton></form>}
                  {i.status === "pending" && <form action={cancelQueueItem}><input type="hidden" name="id" value={i.id} /><SubmitButton className="btn" confirm="Cancelar este item?">Cancelar</SubmitButton></form>}
                  {i.status === "failed" && <form action={retryItem}><input type="hidden" name="id" value={i.id} /><SubmitButton className="btn">Tentar de novo</SubmitButton></form>}
                </div>
              </div>
              {i.status === "pending" ? (
                <form action={saveQueueCaption} className="space-y-1">
                  <input type="hidden" name="id" value={i.id} />
                  <textarea name="caption" defaultValue={i.caption ?? ""} rows={5} className="input font-mono text-xs" />
                  <SubmitButton className="btn">Salvar legenda</SubmitButton>
                </form>
              ) : i.caption ? <pre className="whitespace-pre-wrap rounded border border-line bg-bg p-2 text-xs text-muted">{i.caption}</pre> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
