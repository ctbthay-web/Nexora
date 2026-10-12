import Link from "next/link";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { MAX_LINKS } from "@/lib/promo";
import { fmtDate } from "@/lib/utils";
import { deleteGeneration, generatePromos } from "./actions";

export default async function PromosPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase } = await requireUser();
  const [{ data: tpls }, { data: gens }, { count: sl }, { count: cp }] = await Promise.all([
    supabase.from("message_templates").select("id,name,is_default").order("created_at"),
    supabase.from("generations").select("id,template_name,items,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("slogans").select("id", { count: "exact", head: true }),
    supabase.from("coupons").select("id", { count: "exact", head: true }).eq("active", true),
  ]);
  const def = (tpls ?? []).find((t: any) => t.is_default)?.id ?? "";
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Gerar promoção</h1>
      <Flash searchParams={searchParams} />

      <form action={generatePromos} className="card space-y-3">
        <div>
          <label className="label">Links dos produtos (um por linha, até {MAX_LINKS})</label>
          <textarea name="links" required rows={7} className="input font-mono text-xs" placeholder={"https://www.mercadolivre.com.br/…\nhttps://meli.la/…"} />
          <p className="mt-1 text-xs text-muted">
            Se o produto já está em <Link href="/produtos" className="underline">Produtos</Link>, o Nexora usa os dados salvos dele. Para informar dados na hora, use
            {" "}<code>link | título | preço | preço antigo | cupom</code> (tudo depois do link é opcional). O Nexora <b>não lê o preço sozinho</b> nas lojas e <b>nunca inventa</b> preço, cupom ou frete: linhas sem dado somem da mensagem.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Modelo de mensagem</label>
            <select name="template" className="input" defaultValue={def}>
              <option value="">Modelo padrão do Nexora</option>
              {(tpls ?? []).map((t: any) => <option key={t.id} value={t.id}>{t.name}{t.is_default ? " (padrão)" : ""}</option>)}
            </select>
          </div>
          <div className="space-y-1 pt-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" name="my_links" /> Os links que colei já são meus links de afiliado</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="use_slogan" defaultChecked={!!sl} /> Usar um slogan ({sl ?? 0} cadastrados)</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="use_coupons" defaultChecked={!!cp} /> Incluir cupons cadastrados ({cp ?? 0} ativos)</label>
          </div>
        </div>
        <SubmitButton>Gerar mensagens</SubmitButton>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold">Histórico de gerações</h2>
        {(gens ?? []).length === 0 && <div className="card text-sm text-muted">Nenhuma geração ainda.</div>}
        {(gens ?? []).map((g: any) => {
          const n = (g.items ?? []).length; const sent = (g.items ?? []).filter((i: any) => i.sent_at).length;
          return (
            <div key={g.id} className="card flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/promocoes/${g.id}`} className="font-medium underline">{n} mensagem(ns) • {g.template_name}</Link>
                <p className="text-xs text-muted">{fmtDate(g.created_at)} • {sent} enviada(s) ao Telegram</p>
              </div>
              <form action={deleteGeneration}><input type="hidden" name="id" value={g.id} /><SubmitButton className="btn" confirm="Excluir esta geração?">Excluir</SubmitButton></form>
            </div>
          );
        })}
      </section>
    </div>
  );
}
