import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { CHANNEL_TYPES } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { addChannel, deleteChannel, removeTelegramBot, saveTelegramBot, sendChannelTest, testChannel, toggleChannel, updateChannelDestination } from "./actions";

const ST: Record<string, [string, string]> = {
  connected: ["Conectado", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"],
  not_connected: ["Desconectado", "bg-slate-500/15 text-muted"],
  awaiting_auth: ["Aguardando autorização", "bg-amber-500/15 text-amber-700 dark:text-amber-300"],
  error: ["Erro de conexão", "bg-rose-500/15 text-rose-700 dark:text-rose-300"],
  invalid_credentials: ["Credenciais inválidas", "bg-rose-500/15 text-rose-700 dark:text-rose-300"],
  needs_attention: ["Necessita de intervenção", "bg-amber-500/15 text-amber-700 dark:text-amber-300"],
};

export default async function ChannelsPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase } = await requireUser();
  const [{ data }, { data: bot }] = await Promise.all([
    supabase.from("channels").select("*").order("created_at"),
    supabase.from("telegram_bot").select("bot_username,validated_at").maybeSingle(),
  ]);
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Canais de divulgação</h1>
      <Flash searchParams={searchParams} />

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Bot do Telegram</h2>
          <span className={`badge ${bot ? ST.connected[1] : ST.awaiting_auth[1]}`}>{bot ? `@${bot.bot_username} validado` : "Aguardando token"}</span>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted">
          <li>No Telegram, abra o <b>@BotFather</b>, envie <code>/newbot</code> e siga as perguntas. Ele entrega um <b>token</b>.</li>
          <li>Crie (ou abra) o seu canal/grupo e <b>adicione o bot como administrador</b> com permissão de publicar mensagens.</li>
          <li>Cole o token abaixo (só aqui, nunca no chat) e salve. O Nexora testa no Telegram antes de guardar.</li>
          <li>Cadastre o canal abaixo com o destino <code>@seucanal</code> e clique em <b>Testar conexão</b>.</li>
        </ol>
        <form action={saveTelegramBot} className="flex flex-wrap items-end gap-2">
          <div className="min-w-[16rem] flex-1"><label className="label">Token do bot{bot ? " — já salvo; cole outro para trocar" : ""}</label><input name="bot_token" type="password" autoComplete="off" placeholder={bot ? "••••••••••" : "123456789:AA…"} className="input" /></div>
          <SubmitButton>Validar e salvar</SubmitButton>
        </form>
        {bot && <form action={removeTelegramBot}><SubmitButton className="btn btn-danger" confirm="Desconectar o bot? Os envios do Telegram param.">Desconectar bot</SubmitButton></form>}
      </section>

      <form action={addChannel} className="card grid gap-3 md:grid-cols-4">
        <div>
          <label className="label">Tipo</label>
          <select name="type" className="input" defaultValue="telegram">
            {Object.entries(CHANNEL_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}{v.ready ? "" : ` (${v.phase}, ainda não publica)`}</option>)}
          </select>
        </div>
        <div><label className="label">Nome *</label><input name="name" required className="input" /></div>
        <div><label className="label">Destino (@canal ou ID)</label><input name="destination" className="input" placeholder="@meucanal" /></div>
        <div className="flex items-end"><SubmitButton>Adicionar</SubmitButton></div>
      </form>

      <div className="space-y-2">
        {(data ?? []).length === 0 && <div className="card text-sm text-muted">Nenhum canal cadastrado.</div>}
        {(data ?? []).map((c: any) => {
          const [lbl, cls] = ST[c.status] ?? ST.not_connected;
          return (
            <div key={c.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">{c.name} <span className="text-xs text-muted">({CHANNEL_TYPES[c.type as keyof typeof CHANNEL_TYPES].label})</span> <span className={`badge ${cls}`}>{lbl}</span></p>
                  <p className="text-xs text-muted">{c.destination ?? "sem destino"} · {c.enabled ? "ativo" : "desativado"} · última verificação: {fmtDate(c.last_checked_at)}</p>
                  {c.last_error && <p className="text-xs text-rose-600">Detalhe do erro: {c.last_error}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <form action={testChannel}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn">Testar conexão</SubmitButton></form>
                  {c.status === "connected" && <form action={sendChannelTest}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn" confirm="Isto publica uma mensagem de teste de verdade no canal. Continuar?">Enviar mensagem de teste</SubmitButton></form>}
                  <form action={toggleChannel}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="enabled" value={String(c.enabled)} /><SubmitButton className="btn">{c.enabled ? "Desativar" : "Ativar"}</SubmitButton></form>
                  <form action={deleteChannel}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn btn-danger" confirm="Remover este canal?">Remover</SubmitButton></form>
                </div>
              </div>
              <form action={updateChannelDestination} className="flex items-end gap-2">
                <input type="hidden" name="id" value={c.id} />
                <div className="flex-1"><label className="label">Destino</label><input name="destination" defaultValue={c.destination ?? ""} className="input" placeholder="@meucanal" /></div>
                <SubmitButton className="btn">Salvar destino</SubmitButton>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
