import { brl } from "./utils";

export type CaptionInput = {
  title?: string | null; price?: number | null; previous_price?: number | null; coupon?: string | null;
  free_shipping?: boolean | null; shipping_info?: string | null; shipping_coupon?: string | null;
  affiliate_url?: string | null;
};

/** Monta a legenda só com campos preenchidos. Nunca inventa preço, cupom, frete ou urgência. */
export function buildCaption(p: CaptionInput): string {
  const lines: string[] = [];
  if (p.title) lines.push(`🔥 ${p.title}`);
  if (p.price != null && !Number.isNaN(p.price)) {
    let l = `💰 Por ${brl(p.price)}`;
    if (p.previous_price && p.previous_price > p.price) {
      const d = Math.round(((p.previous_price - p.price) / p.previous_price) * 100);
      l += ` (de ${brl(p.previous_price)} • -${d}%)`;
    }
    lines.push(l);
  }
  if (p.coupon) lines.push(`🎟️ Cupom: ${p.coupon}`);
  if (p.free_shipping) lines.push("🚚 Frete grátis");
  if (p.shipping_info) lines.push(`🚚 ${p.shipping_info}`);
  if (p.shipping_coupon) lines.push(`🎫 Cupom de frete: ${p.shipping_coupon}`);
  if (p.affiliate_url) lines.push("", `👉 Compre aqui: ${p.affiliate_url}`);
  return lines.join("\n");
}
