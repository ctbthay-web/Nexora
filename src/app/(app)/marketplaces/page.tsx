import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { MARKETPLACES, type MarketplaceKey } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import CopyButton from "@/components/CopyButton";
import { headers } from "next/headers";
import { removeSessionCookie, saveSessionCookie, removeShopeeApi, saveMarketplace, saveMlApp, saveShopeeApi, testMarketplace } from "./actions";

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
  const { data: shopeeApi } = await supabase.from("shopee_api").select("app_id").maybeSingle();
  const { data: ckRows } = await supabase.from("session_cookies").select("marketplace,updated_at");
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
                  <p className="text-muted">Passo a passo para conectar sem erro, em <b>developers.mercadolivre.com.br</b> → Minhas aplicações → sua aplicação → Editar:</p>
                  <ol className="list-decimal space-y-1 pl-5 text-muted">
                    <li><b>URIs de redirect:</b> cole o endereço abaixo e clique em “Adicionar URI de redirect” (precisa aparecer na lista).</li>
                    <li><b>Fluxos OAuth:</b> deixe marcados “Authorization Code” e “Refresh Token”.</li>
                    <li><b>PKCE:</b> pode ficar marcado ou desmarcado, o Nexora já suporta.</li>
                    <li><b>Permissões (scopes):</b> só leitura (informações do usuário e itens/busca).</li>
                    <li><b>URL de notificações:</b> deixe vazia.</li>
                    <li>Marque o reCAPTCHA só na hora de clicar em “Editar”.</li>
                    <li>Abaixo, preencha ID e chave da aplicação, clique em “Salvar aplicação”, depois em “Conectar Mercado Livre” e “Permitir”.</li>
                  </ol>
                  <p className="text-muted">URI de redirect (copie exatamente assim, sem espaço e sem barra no final):</p>
                  <code className="block break-all rounded border border-line bg-card p-2">{redirectUri}</code>
                  <CopyButton text={redirectUri} label="Copiar endereço" />
                  <p className="text-muted">Abra o app sempre por este mesmo endereço (<b>{redirectUri.replace("/api/ml/callback", "")}</b>); outro endereço da Vercel gera outro redirect e dá erro.</p>
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
              {k === "shopee" && (
                <div className="space-y-2 rounded-lg border border-line bg-bg p-3 text-xs">
                  <p className="font-semibold">API de afiliados da Shopee (App ID e Secret)</p>
                  <p className="text-muted">A Secret fica guardada só no servidor, protegida por RLS, e nunca volta para a tela. Nunca envie a Secret no chat. Por enquanto o Nexora só guarda estes dados; a busca de produtos da Shopee ainda será ligada.</p>
                  <form action={saveShopeeApi} className="space-y-2">
                    <div><label className="label">App ID</label><input name="app_id" defaultValue={shopeeApi?.app_id ?? ""} autoComplete="off" className="input" /></div>
                    <div><label className="label">Secret{shopeeApi ? " — já salva; deixe em branco para manter" : ""}</label><input name="app_secret" type="password" autoComplete="off" placeholder={shopeeApi ? "••••••••••" : ""} className="input" /></div>
                    <SubmitButton>Salvar App ID e Secret</SubmitButton>
                  </form>
                  {shopeeApi && <form action={removeShopeeApi}><SubmitButton className="btn btn-danger" confirm="Remover o App ID e a Secret da Shopee?">Remover credenciais</SubmitButton></form>}
                </div>
              )}
              {(k === "mercadolivre" || k === "shopee") && (() => {
                const ck = (ckRows ?? []).find((r: any) => r.marketplace === k);
                return (
                  <div className="space-y-2 rounded-lg border border-line bg-bg p-3 text-xs">
                    <p className="font-semibold">Cookie de sessão{ck ? ` — salvo em ${fmtDate(ck.updated_at)}` : ""}</p>
                    <p className="text-muted">Cole o texto do cookie ou o JSON exportado pelo Cookie-Editor. Fica criptografado no servidor, nunca volta para a tela e você pode trocar ou remover quando quiser. Hoje ele é enviado só para a própria loja quando você usa "Importar por link" em Produtos. Se a loja bloquear mesmo assim, o app avisa. Quem tiver este cookie acessa sua conta: nunca cole no chat e troque-o (saindo da conta no site) se suspeitar de vazamento.</p>
                    <form action={saveSessionCookie} className="space-y-2">
                      <input type="hidden" name="marketplace" value={k} />
                      <textarea name="cookie" rows={3} autoComplete="off" spellCheck={false} placeholder={ck ? "Cookie já salvo — cole um novo para trocar" : "Cole o cookie aqui"} className="input font-mono" />
                      <SubmitButton>{ck ? "Trocar cookie" : "Salvar cookie"}</SubmitButton>
                    </form>
                    {ck && <form action={removeSessionCookie}><input type="hidden" name="marketplace" value={k} /><SubmitButton className="btn btn-danger" confirm="Remover o cookie salvo?">Remover cookie</SubmitButton></form>}
                  </div>
                );
              })()}
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
