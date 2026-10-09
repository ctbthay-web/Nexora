import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { MARKETPLACES, type MarketplaceKey } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { saveMarketplace, testMarketplace } from "./actions";

const ST: Record<string, [string, string]> = {
  not_configured: ["Não configurado", "bg-slate-500/15 text-muted"],
  configured: ["Configurado (API não testada)", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"],
  error: ["Com erro", "bg-rose-500/15 text-rose-700 dark:text-rose-300"],
};

export default async function MarketplacesPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("marketplace_connections").select("*");
  const byKey = new Map((data ?? []).map((r: any) => [r.marketplace, r]));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Marketplaces e afiliados</h1>
      <Flash searchParams={searchParams} />
      <p className="text-xs text-muted">Chaves secretas de API (App ID, Secret…) nunca são digitadas aqui: ficam nas variáveis de ambiente do servidor (.env.local) a partir da Fase 2. Esta tela guarda só o identificador público de afiliado.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {(Object.keys(MARKETPLACES) as MarketplaceKey[]).map((k) => {
          const m = MARKETPLACES[k];
          const c: any = byKey.get(k);
          const [stLabel, stCls] = ST[c?.status ?? "not_configured"];
          return (
            <section key={k} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{m.label}</h2>
                <span className={`badge ${stCls}`}>{stLabel}</span>
              </div>
              <p className="text-xs text-muted"><b>Autenticação:</b> {m.auth}</p>
              <p className="text-xs text-muted">{m.howTo}</p>
              <form action={saveMarketplace} className="space-y-2">
                <input type="hidden" name="marketplace" value={k} />
                <div><label className="label">{m.idLabel}</label><input name="affiliate_id" defaultValue={c?.affiliate_id ?? ""} className="input" /></div>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="enabled" defaultChecked={c?.enabled} /> Ativo</label>
                <SubmitButton>Salvar</SubmitButton>
              </form>
              <form action={testMarketplace} className="flex items-center justify-between gap-2">
                <input type="hidden" name="marketplace" value={k} />
                <SubmitButton className="btn">Verificar configuração</SubmitButton>
                <span className="text-right text-[11px] text-muted">Última sincronização: {fmtDate(c?.last_sync_at)}</span>
              </form>
              {c?.last_error && <p className="text-xs text-rose-600">Erro: {c.last_error}</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}
