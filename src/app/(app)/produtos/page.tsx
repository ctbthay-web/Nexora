import Link from "next/link";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { MARKETPLACES, PRODUCT_STATUS, type MarketplaceKey } from "@/lib/constants";
import { brl, fmtDate } from "@/lib/utils";
import { deleteProduct, duplicateProduct, enqueue, loadDemo, setStatus, toggleFavorite } from "./actions";

type SP = { ok?: string; err?: string; q?: string; mp?: string; st?: string; fav?: string };

export default async function Products({ searchParams }: { searchParams: SP }) {
  const { supabase, user } = await requireUser();
  let q = supabase.from("products").select("*").order("created_at", { ascending: false }).limit(200);
  if (searchParams.q) q = q.ilike("title", `%${searchParams.q.replace(/[%,]/g, " ")}%`);
  if (searchParams.mp) q = q.eq("marketplace", searchParams.mp);
  if (searchParams.st) q = q.eq("status", searchParams.st);
  if (searchParams.fav === "1") q = q.eq("favorite", true);

  const [{ data: products }, { data: channels }, { data: prof }] = await Promise.all([
    q,
    supabase.from("channels").select("id,name,type").eq("enabled", true),
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
  ]);
  const tz = prof?.timezone ?? "America/Sao_Paulo";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Produtos</h1>
        <div className="flex gap-2">
          <form action={loadDemo}><SubmitButton className="btn">Carregar demonstração</SubmitButton></form>
          <Link href="/produtos/novo" className="btn btn-primary">+ Novo produto</Link>
        </div>
      </div>
      <Flash searchParams={searchParams} />

      <form className="card grid gap-2 md:grid-cols-5" method="get">
        <input name="q" defaultValue={searchParams.q} placeholder="Buscar por nome…" className="input md:col-span-2" />
        <select name="mp" defaultValue={searchParams.mp ?? ""} className="input">
          <option value="">Todos marketplaces</option>
          {Object.entries(MARKETPLACES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select name="st" defaultValue={searchParams.st ?? ""} className="input">
          <option value="">Todos status</option>
          {Object.entries(PRODUCT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="fav" value="1" defaultChecked={searchParams.fav === "1"} /> Favoritos</label>
          <button className="btn">Filtrar</button>
        </div>
      </form>

      <p className="text-xs text-muted">
        A busca automática em marketplaces chega na Fase 2. Aqui você cadastra produtos manualmente. Itens [DEMO] são fictícios e não podem ser publicados sem link de afiliado confirmado.
      </p>

      {(products ?? []).length === 0 ? (
        <div className="card text-sm text-muted">Nenhum produto encontrado.</div>
      ) : (
        <div className="space-y-3">
          {(products ?? []).map((p: any) => {
            const st = PRODUCT_STATUS[p.status];
            return (
              <article key={p.id} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="font-semibold">{p.favorite ? "⭐ " : ""}{p.title}</h2>
                    <p className="text-xs text-muted">
                      {MARKETPLACES[p.marketplace as MarketplaceKey]?.label} · {p.category ?? "sem categoria"} · origem: {p.source} · dados de {fmtDate(p.data_updated_at, tz)}
                    </p>
                  </div>
                  <span className={`badge ${st?.cls}`}>{st?.label}</span>
                </div>
                <div className="flex flex-wrap items-baseline gap-3 text-sm">
                  <span className="text-lg font-bold">{brl(p.price)}</span>
                  {p.previous_price && <span className="text-muted line-through">{brl(p.previous_price)}</span>}
                  {p.discount_pct && <span className="badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">-{p.discount_pct}%</span>}
                  {p.coupon && <span className="badge bg-indigo-500/15">Cupom: {p.coupon}</span>}
                  {p.free_shipping && <span className="text-xs">Frete grátis</span>}
                  {p.rating && <span className="text-xs">★ {p.rating}</span>}
                  <span className={`text-xs ${p.affiliate_verified ? "text-emerald-600" : "text-amber-600"}`}>
                    {p.affiliate_verified ? "✔ link de afiliado confirmado" : "⚠ sem link de afiliado confirmado"}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <form action={setStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="approved" /><SubmitButton className="btn">Aprovar</SubmitButton></form>
                  <form action={setStatus}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value="rejected" /><SubmitButton className="btn">Rejeitar</SubmitButton></form>
                  <form action={toggleFavorite}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="fav" value={String(p.favorite)} /><SubmitButton className="btn">{p.favorite ? "Desfavoritar" : "Favoritar"}</SubmitButton></form>
                  <Link href={`/produtos/${p.id}`} className="btn">Editar</Link>
                  <form action={duplicateProduct}><input type="hidden" name="id" value={p.id} /><SubmitButton className="btn">Duplicar</SubmitButton></form>
                  <form action={deleteProduct}><input type="hidden" name="id" value={p.id} /><SubmitButton className="btn btn-danger" confirm="Excluir este produto?">Excluir</SubmitButton></form>
                </div>

                {p.status === "approved" && (
                  <form action={enqueue} className="flex flex-wrap items-end gap-2 border-t border-line pt-3">
                    <input type="hidden" name="id" value={p.id} />
                    <div>
                      <label className="label">Canal</label>
                      <select name="channel_id" required className="input" defaultValue="">
                        <option value="" disabled>{(channels ?? []).length ? "Selecione…" : "Cadastre um canal primeiro"}</option>
                        {(channels ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                      </select>
                    </div>
                    <div><label className="label">Agendar para ({tz})</label><input type="datetime-local" name="scheduled_for" required className="input" /></div>
                    <SubmitButton>Enfileirar</SubmitButton>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
