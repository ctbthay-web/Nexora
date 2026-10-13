import { createHash } from "crypto";
import { detectMarketplace, extractExternalId } from "./promo";
import { isValidUrl } from "./utils";

export const MAX_INGEST = 50;

export type IngestRow = {
  marketplace: string; external_id: string; title: string; price: number; previous_price: number | null;
  image_url: string | null; original_url: string; coupon: string | null; free_shipping: boolean | null; category: string | null;
};

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    let s = v.replace(/[R$\s]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const txt = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** Valida o que o n8n envia. Só aceita lojas conhecidas e dados completos; nada é inventado ou "corrigido". */
export function validateIngest(body: unknown): { rows: IngestRow[]; rejected: { index: number; reason: string }[] } {
  const list = Array.isArray((body as any)?.products) ? (body as any).products.slice(0, MAX_INGEST) : [];
  const rows: IngestRow[] = []; const rejected: { index: number; reason: string }[] = [];
  list.forEach((p: any, i: number) => {
    const url = txt(p?.url, 2000);
    if (!url || !isValidUrl(url)) return void rejected.push({ index: i, reason: "url inválida" });
    const mk = detectMarketplace(url);
    if (!mk) return void rejected.push({ index: i, reason: "loja não reconhecida" });
    const title = txt(p?.title, 300);
    if (!title) return void rejected.push({ index: i, reason: "sem título" });
    const price = num(p?.price);
    if (price == null || price <= 0 || price > 1_000_000) return void rejected.push({ index: i, reason: "preço inválido" });
    const prevRaw = num(p?.previous_price);
    const image = txt(p?.image_url, 2000);
    rows.push({
      marketplace: mk, title, price, previous_price: prevRaw != null && prevRaw > price ? prevRaw : null,
      external_id: extractExternalId(url) ?? `url-${createHash("sha1").update(url).digest("hex").slice(0, 20)}`,
      image_url: image && isValidUrl(image) ? image : null, original_url: url,
      coupon: txt(p?.coupon, 60), free_shipping: typeof p?.free_shipping === "boolean" ? p.free_shipping : null, category: txt(p?.category, 80),
    });
  });
  return { rows, rejected };
}
