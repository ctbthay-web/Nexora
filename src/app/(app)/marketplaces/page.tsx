import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { MARKETPLACES, type MarketplaceKey } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { headers } from "next/headers";
import { saveMarketplace, saveMlApp, testMarketplace } from "./actions";

const LOGTXT: Record<string, string> = {
  "ml.credentials_saved": "Aplicação salva",
  "ml.connected": "Conectado",
  "marketplace.checked": "Teste de conexão OK",
  "marketplace.test_failed": "Teste de conexão falhou",
};

const ST: Record<string, [string, string]> = {
  not_configured: ["Não configurado", "bg-slate-500/15 text-muted"],
  configured: ["Configurado (API não testada)", "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"],
  error: ["Com erro", "bg-rose-500/15 text-rose-700 dark:text-rose-300"],
};

export default async function MarketplacesPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase, user } = await requireUser();
  const { data: mlApp } = await supabase.from("ml_app").select("client_id").maybeSingle();
  const { data: mlLog } = await supabase.from("activity_log").select("action,created_at").eq("details->>title", "Mercado Livre").order("created_at", { ascending: false }).limit(5);
  const h = headers();
  const redirectUri = `https://${h.get("x-forwarded-host") ?? h.get("host")}/api/ml/callback`;
  void user;
  const { data } = await supabase.from("marketplace_connections").select("*");
  const { data: mlTok } = await supabase.from("ml_tokens").select("ml_user_id,expires_at").maybeSingle();
  const byKey = new Map((data ?? []).map((r: any) => [r.marketplace, r]));
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Marketplaces e afiliados</h1>
      <Flash searchParams={searchParams} />
      <p className="text-xs text-muted">O identificador de afiliado é público. Para o Mercado Livre, o ID e a chave da sua aplicação ficam salvos na sua conta (protegidos por RLS) e nunca voltam para a tela. As demais chaves ficam no servidor.</p>
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
              {k === "mercadolivre" && (
                <div className="space-y-3 rounded-lg border border-line bg-bg p-3 text-xs">
                  <p className="font-semibold">Conexão pela sua aplicação do Mercado Livre</p>
                  <p className="text-muted">No painel de desenvolvedores do Mercado Livre, cadastre esta URL de redirecionamento (exatamente assim):</p>
                  <code className="block break-all rounded border border-line bg-card p-2">{redirectUri}</code>
                  <form action={saveMlApp} className="space-y-2">
                    <div><label className="label">ID da aplicação (Client ID)</label><input name="client_id" defaultValue={mlApp?.client_id ?? ""} inputMode="numeric" className="input" /></div>
                    <div><label className="label">Chave secreta (Client Secret){mlApp ? " — já salva; deixe em branco para manter" : ""}</label><input name="client_secret" type="password" autoComplete="off" placeholder={mlApp ? "••••••••••" : ""} className="input" /></div>
                    <SubmitButton>Salvar aplicação</SubmitButton>
                  </form>
                  {!mlApp ? null : mlTok ? (
                    <p className="text-emerald-600">✔ Conectado ao Mercado Livre{mlTok.ml_user_id ? ` (conta ${mlTok.ml_user_id})` : ""}. <a href="/api/ml/connect" className="underline">Reconectar</a> · <a href="/buscar" className="underline">Buscar produtos</a></p>
                  ) : (
                    <a href="/api/ml/connect" className="btn btn-primary">Conectar Mercado Livre</a>
                  )}
                  {(mlLog ?? []).length > 0 && (
                    <div className="border-t border-line pt-2 text-muted">
                      <p className="mb-1 font-semibold">Registro da conexão</p>
                      {(mlLog ?? []).map((l: any, n: number) => <p key={n}>{fmtDate(l.created_at)} · {LOGTXT[l.action] ?? l.action}</p>)}
                    </div>
                  )}
                </div>
              )}
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
