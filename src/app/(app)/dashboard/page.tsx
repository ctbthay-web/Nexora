import Link from "next/link";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { MARKETPLACES, PRODUCT_STATUS, type MarketplaceKey } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { toggleAutomation } from "./actions";

export default async function Dashboard({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase, user } = await requireUser();
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const count = async (table: string, f: (q: any) => any) => {
    const { count } = await f(supabase.from(table).select("id", { count: "exact", head: true }));
    return count ?? 0;
  };

  const [profile, found24h, approved, pending, sent, channelsOn, byStatus, mkts, chans, activity] = await Promise.all([
    supabase.from("profiles").select("automation_status,timezone").eq("id", user.id).single(),
    count("products", (q) => q.gte("created_at", since)),
    count("products", (q) => q.eq("status", "approved")),
    count("publish_queue", (q) => q.eq("status", "pending")),
    count("publish_queue", (q) => q.eq("status", "sent")),
    count("channels", (q) => q.eq("enabled", true)),
    supabase.from("products").select("status"),
    supabase.from("marketplace_connections").select("marketplace,enabled,status"),
    supabase.from("channels").select("id", { count: "exact", head: true }),
    supabase.from("activity_log").select("action,details,created_at").order("created_at", { ascending: false }).limit(8),
  ]);

  const tz = profile.data?.timezone ?? "America/Sao_Paulo";
  const running = profile.data?.automation_status === "running";
  const statusCounts: Record<string, number> = {};
  (byStatus.data ?? []).forEach((r: any) => (statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1));
  const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);

  const alerts: string[] = [];
  (mkts.data ?? []).forEach((m: any) => {
    if (m.enabled && m.status !== "configured") alerts.push(`${MARKETPLACES[m.marketplace as MarketplaceKey].label} está ativo, mas sem configuração completa.`);
  });
  if ((chans.count ?? 0) === 0) alerts.push("Nenhum canal cadastrado. Cadastre um canal em Canais para poder enfileirar publicações.");

  const cards: [string, string | number, string?][] = [
    ["Produtos (últimas 24h)", found24h],
    ["Ofertas aprovadas", approved],
    ["Aguardando publicação", pending],
    ["Publicações realizadas", sent, "Contagem real; envio automático chega na Fase 3"],
    ["Campanhas ativas", 0, "Campanhas: Fase 3"],
    ["Canais ativos", channelsOn],
    ["Cliques rastreados", "—", "Rastreamento: Fase 4"],
    ["Vendas / comissões", "—", "Somente com confirmação da fonte (Fase 4)"],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <form action={toggleAutomation} className="flex items-center gap-3">
          <span className={`badge ${running ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" : "bg-slate-500/15 text-muted"}`}>
            Automação: {running ? "ativa" : "pausada"}
          </span>
          <SubmitButton>{running ? "Pausar" : "Iniciar"}</SubmitButton>
        </form>
      </div>
      <Flash searchParams={searchParams} />
      {running && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
          O executor em servidor (busca e publicação automáticas) é entregue na Fase 3. Por ora este botão apenas registra o estado desejado.
        </div>
      )}
      {alerts.length > 0 && (
        <div className="card space-y-1 border-amber-500/40">
          <h2 className="text-sm font-semibold">Alertas</h2>
          {alerts.map((a) => <p key={a} className="text-sm">⚠️ {a}</p>)}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, hint]) => (
          <div key={label} className="card">
            <p className="text-xs text-muted">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
            {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Produtos por status</h2>
          {total === 0 ? (
            <p className="text-sm text-muted">Nenhum produto ainda. <Link className="text-brand underline" href="/produtos">Cadastre ou carregue a demonstração.</Link></p>
          ) : (
            <div className="space-y-2">
              {Object.entries(statusCounts).map(([s, n]) => (
                <div key={s}>
                  <div className="flex justify-between text-xs"><span>{PRODUCT_STATUS[s]?.label ?? s}</span><span>{n}</span></div>
                  <div className="h-2 rounded bg-line"><div className="h-2 rounded bg-brand" style={{ width: `${(n / total) * 100}%` }} /></div>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 text-sm font-semibold">Últimas atividades</h2>
          {(activity.data ?? []).length === 0 ? (
            <p className="text-sm text-muted">Sem atividades registradas.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {(activity.data ?? []).map((a: any, i: number) => (
                <li key={i} className="flex justify-between gap-2">
                  <span className="truncate">{a.action}{a.details?.title ? ` — ${a.details.title}` : ""}</span>
                  <span className="shrink-0 text-xs text-muted">{fmtDate(a.created_at, tz)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
