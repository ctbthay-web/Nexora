import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { CHANNEL_TYPES } from "@/lib/constants";
import { addChannel, deleteChannel, toggleChannel } from "./actions";

export default async function ChannelsPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("channels").select("*").order("created_at");
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Canais de divulgação</h1>
      <Flash searchParams={searchParams} />
      <p className="text-xs text-muted">Aqui você registra os destinos. A conexão real (token do bot do Telegram, testes e envio) chega na Fase 3; WhatsApp e Instagram na Fase 4. Todos os canais ficam como “não conectado” até lá.</p>

      <form action={addChannel} className="card grid gap-3 md:grid-cols-4">
        <div>
          <label className="label">Tipo</label>
          <select name="type" className="input" defaultValue="telegram">
            {Object.entries(CHANNEL_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label} ({v.phase})</option>)}
          </select>
        </div>
        <div><label className="label">Nome *</label><input name="name" required className="input" /></div>
        <div><label className="label">Destino (@canal ou ID)</label><input name="destination" className="input" /></div>
        <div className="flex items-end"><SubmitButton>Adicionar</SubmitButton></div>
      </form>

      <div className="space-y-2">
        {(data ?? []).length === 0 && <div className="card text-sm text-muted">Nenhum canal cadastrado.</div>}
        {(data ?? []).map((c: any) => (
          <div key={c.id} className="card flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-medium">{c.name} <span className="text-xs text-muted">({CHANNEL_TYPES[c.type as keyof typeof CHANNEL_TYPES].label})</span></p>
              <p className="text-xs text-muted">{c.destination ?? "sem destino"} · {c.enabled ? "ativo" : "desativado"} · não conectado</p>
            </div>
            <div className="flex gap-2">
              <form action={toggleChannel}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="enabled" value={String(c.enabled)} /><SubmitButton className="btn">{c.enabled ? "Desativar" : "Ativar"}</SubmitButton></form>
              <form action={deleteChannel}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn btn-danger" confirm="Remover este canal?">Remover</SubmitButton></form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
