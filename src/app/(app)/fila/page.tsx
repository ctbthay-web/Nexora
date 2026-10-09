import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { fmtDate } from "@/lib/utils";
import { cancelQueueItem } from "./actions";

const LABEL: Record<string, string> = { pending: "Pendente", sent: "Enviado", failed: "Falhou", canceled: "Cancelado" };

export default async function QueuePage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase, user } = await requireUser();
  const [{ data: items }, { data: prof }] = await Promise.all([
    supabase.from("publish_queue").select("id,status,scheduled_for,attempts,last_error,products(title),channels(name,type)")
      .order("scheduled_for", { ascending: true }).limit(200),
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
  ]);
  const tz = prof?.timezone ?? "America/Sao_Paulo";
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Fila de publicação</h1>
      <Flash searchParams={searchParams} />
      <p className="text-xs text-muted">Os itens ficam salvos e protegidos contra duplicidade. O envio automático para o Telegram é a Fase 3: até lá nenhum item é enviado.</p>
      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead className="border-b border-line"><tr><th className="th">Produto</th><th className="th">Canal</th><th className="th">Agendado ({tz})</th><th className="th">Status</th><th className="th" /></tr></thead>
          <tbody>
            {(items ?? []).length === 0 && <tr><td className="td text-muted" colSpan={5}>Fila vazia. Aprove um produto e use “Enfileirar”.</td></tr>}
            {(items ?? []).map((i: any) => (
              <tr key={i.id} className="border-b border-line last:border-0">
                <td className="td">{i.products?.title}</td>
                <td className="td">{i.channels?.name} <span className="text-xs text-muted">({i.channels?.type})</span></td>
                <td className="td">{fmtDate(i.scheduled_for, tz)}</td>
                <td className="td">{LABEL[i.status]}{i.last_error ? <span className="block text-xs text-rose-600">{i.last_error}</span> : null}</td>
                <td className="td text-right">
                  {i.status === "pending" && (
                    <form action={cancelQueueItem}><input type="hidden" name="id" value={i.id} /><SubmitButton className="btn" confirm="Cancelar este item?">Cancelar</SubmitButton></form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
