import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { MARKETPLACES, type MarketplaceKey } from "@/lib/constants";
import { addCoupon, deleteCoupon, toggleCoupon } from "./actions";

export default async function CouponsPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase } = await requireUser();
  const { data } = await supabase.from("coupons").select("*").order("created_at", { ascending: false });
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Cupons</h1>
      <Flash searchParams={searchParams} />
      <p className="text-sm text-muted">Cadastre aqui os cupons que você mesmo conferiu. Eles entram nas mensagens de <b>Gerar promoção</b> (cupom da loja do link). O Nexora não descobre cupons sozinho.</p>
      <form action={addCoupon} className="card grid gap-3 md:grid-cols-4">
        <div><label className="label">Loja</label>
          <select name="marketplace" className="input" defaultValue="">
            <option value="">Todas</option>
            {(Object.keys(MARKETPLACES) as MarketplaceKey[]).map((k) => <option key={k} value={k}>{MARKETPLACES[k].label}</option>)}
          </select></div>
        <div><label className="label">Código *</label><input name="code" required className="input" /></div>
        <div><label className="label">Validade</label><input name="expires_on" type="date" className="input" /></div>
        <div><label className="label">Descrição</label><input name="description" className="input" placeholder="Ex.: 10% acima de R$ 99" /></div>
        <div className="md:col-span-4"><SubmitButton>Cadastrar cupom</SubmitButton></div>
      </form>
      <div className="space-y-2">
        {(data ?? []).length === 0 && <div className="card text-sm text-muted">Nenhum cupom cadastrado.</div>}
        {(data ?? []).map((c: any) => {
          const expired = c.expires_on && c.expires_on < today;
          return (
            <div key={c.id} className="card flex flex-wrap items-center justify-between gap-2">
              <div>
                <b className="font-mono">{c.code}</b>
                <span className="ml-2 text-xs text-muted">{c.marketplace ? MARKETPLACES[c.marketplace as MarketplaceKey].label : "Todas as lojas"}{c.expires_on ? ` • até ${c.expires_on.split("-").reverse().join("/")}` : ""}</span>
                {expired && <span className="badge ml-2 bg-rose-500/15 text-rose-700 dark:text-rose-300">vencido</span>}
                {!c.active && <span className="badge ml-2 bg-slate-500/15 text-muted">desativado</span>}
                {c.description && <p className="text-xs text-muted">{c.description}</p>}
              </div>
              <div className="flex gap-2">
                <form action={toggleCoupon}><input type="hidden" name="id" value={c.id} /><input type="hidden" name="active" value={c.active ? "1" : "0"} /><SubmitButton className="btn">{c.active ? "Desativar" : "Ativar"}</SubmitButton></form>
                <form action={deleteCoupon}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn" confirm="Excluir este cupom?">Excluir</SubmitButton></form>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
