import SubmitButton from "@/components/SubmitButton";
import CaptionField from "@/components/CaptionField";
import { MARKETPLACES } from "@/lib/constants";
import { saveProduct } from "./actions";

export default function ProductForm({ p }: { p?: any }) {
  return (
    <form action={saveProduct} className="card grid gap-3 md:grid-cols-2">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="md:col-span-2">
        <label className="label" htmlFor="title">Nome do produto *</label>
        <input id="title" name="title" required defaultValue={p?.title} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="marketplace">Marketplace *</label>
        <select id="marketplace" name="marketplace" required defaultValue={p?.marketplace ?? ""} className="input">
          <option value="" disabled>Selecione…</option>
          {Object.entries(MARKETPLACES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="category">Categoria / nicho</label>
        <input id="category" name="category" defaultValue={p?.category ?? ""} placeholder="Eletrônicos, Casa, Beleza…" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="price">Preço atual (R$) *</label>
        <input id="price" name="price" required inputMode="decimal" defaultValue={p?.price ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="previous_price">Preço anterior (R$) — só se confirmado</label>
        <input id="previous_price" name="previous_price" inputMode="decimal" defaultValue={p?.previous_price ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="coupon">Cupom (só se real)</label>
        <input id="coupon" name="coupon" defaultValue={p?.coupon ?? ""} className="input" />
      </div>
      <div>
        <label className="label" htmlFor="rating">Avaliação (0 a 5)</label>
        <input id="rating" name="rating" inputMode="decimal" defaultValue={p?.rating ?? ""} className="input" />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="original_url">Link original do produto</label>
        <input id="original_url" name="original_url" type="url" defaultValue={p?.original_url ?? ""} className="input" />
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="affiliate_url">Link de afiliado (gerado no seu programa)</label>
        <input id="affiliate_url" name="affiliate_url" type="url" defaultValue={p?.affiliate_url ?? ""} className="input" />
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input type="checkbox" name="affiliate_verified" defaultChecked={p?.affiliate_verified} />
          Confirmo que testei este link e ele leva ao produto com o meu identificador
        </label>
      </div>
      <div className="md:col-span-2">
        <label className="label" htmlFor="image_url">Imagem do produto (endereço da imagem)</label>
        <input id="image_url" name="image_url" type="url" defaultValue={p?.image_url ?? ""} placeholder="Cole o endereço da imagem do produto (clique direito na foto → copiar endereço da imagem)" className="input" />
        {p?.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.image_url} alt="" className="mt-2 h-32 w-32 rounded-lg border border-line object-cover" />}
      </div>
      <label className="flex items-center gap-2 text-sm md:col-span-2">
        <input type="checkbox" name="free_shipping" defaultChecked={p?.free_shipping === true} /> Frete grátis confirmado
      </label>
      <div>
        <label className="label" htmlFor="shipping_info">Informação de frete</label>
        <input id="shipping_info" name="shipping_info" defaultValue={p?.shipping_info ?? ""} placeholder="Ex.: frete grátis acima de R$ 79 · chega em até 5 dias" className="input" />
      </div>
      <div>
        <label className="label" htmlFor="shipping_coupon">Cupom de frete (só se real)</label>
        <input id="shipping_coupon" name="shipping_coupon" defaultValue={p?.shipping_coupon ?? ""} placeholder="Ex.: FRETEGRATIS" className="input" />
      </div>
      <div className="md:col-span-2"><CaptionField defaultValue={p?.promo_text} /></div>
      <div className="md:col-span-2"><SubmitButton>{p ? "Salvar alterações" : "Cadastrar produto"}</SubmitButton></div>
    </form>
  );
}
