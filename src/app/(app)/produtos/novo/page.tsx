import Flash from "@/components/Flash";
import Bookmarklet from "@/components/Bookmarklet";
import { buildCaption } from "@/lib/caption";
import { parseMoney } from "@/lib/utils";
import { headers } from "next/headers";
import ProductForm from "../ProductForm";

type SP = { ok?: string; err?: string; title?: string; price?: string; previous_price?: string; image?: string; url?: string };

const https = (v?: string) => { try { const u = new URL(String(v ?? "")); return u.protocol === "https:" ? u.toString() : ""; } catch { return ""; } };

export default function NewProduct({ searchParams }: { searchParams: SP }) {
  const h = headers();
  const origin = `https://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const title = (searchParams.title ?? "").trim().slice(0, 300);
  const price = parseMoney(searchParams.price);
  const prev = parseMoney(searchParams.previous_price);
  let prefill: any = null;
  if (title) {
    const previous = prev != null && price != null && prev > price ? prev : null;
    prefill = {
      title, marketplace: "mercadolivre", price: price ?? "", previous_price: previous ?? "",
      image_url: https(searchParams.image), original_url: https(searchParams.url),
      promo_text: buildCaption({ title, price, previous_price: previous, coupon: null, free_shipping: false, shipping_info: null, shipping_coupon: null, affiliate_url: null }),
    };
  }
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Novo produto</h1>
      <Flash searchParams={searchParams} />
      {prefill && <p className="rounded-lg border border-line bg-bg p-3 text-xs text-emerald-700">Dados lidos da página do produto. Confira, cole o seu link de afiliado e cadastre. Frete e cupom não vêm da página: preencha se houver.</p>}
      <ProductForm prefill={prefill} bookmarklet={!prefill ? <Bookmarklet origin={origin} /> : null} />
    </div>
  );
}
