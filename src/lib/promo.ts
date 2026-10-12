import { brl, calcDiscount, isValidUrl, parseMoney } from "./utils";
import type { MarketplaceKey } from "./constants";

export const MAX_LINKS = 30;

export const DEFAULT_TEMPLATE = `{slogan}
🔥 {titulo}
💰 {oferta}
🎟️ Cupom: {cupom}
🚚 {frete}

👉 Compre aqui: {link}`;

export const PLACEHOLDERS: [string, string][] = [
  ["{titulo}", "nome do produto"],
  ["{oferta}", "“Por R$ 99,90 (de R$ 129,90 • -23%)” — só com o que você informou"],
  ["{preco}", "preço atual"],
  ["{preco_antigo}", "preço anterior"],
  ["{desconto}", "desconto em %"],
  ["{cupom}", "cupom"],
  ["{frete}", "“Frete grátis” (só se marcado)"],
  ["{loja}", "nome da loja"],
  ["{slogan}", "um dos seus slogans"],
  ["{link}", "link do produto"],
];

const HOSTS: [RegExp, MarketplaceKey][] = [
  [/(^|\.)mercadolivre\.com(\.br)?$|(^|\.)mercadolibre\.com$|(^|\.)meli\.la$/i, "mercadolivre"],
  [/(^|\.)shopee\.com\.br$|(^|\.)shp\.ee$|(^|\.)s\.shopee\.com\.br$/i, "shopee"],
  [/(^|\.)amazon\.com\.br$|(^|\.)amzn\.to$/i, "amazon"],
  [/(^|\.)magazineluiza\.com\.br$|(^|\.)magalu\.com$|(^|\.)divulgador\.magalu\.com$/i, "magalu"],
  [/(^|\.)shein\.com(\.br)?$|(^|\.)shein\.top$/i, "shein"],
];

export function detectMarketplace(url: string): MarketplaceKey | null {
  try {
    const h = new URL(url).hostname;
    for (const [re, k] of HOSTS) if (re.test(h)) return k;
  } catch {}
  return null;
}

export type ParsedLine = {
  url: string; title: string | null; price: number | null; previous_price: number | null; coupon: string | null;
};

/** Cada linha: `link` ou `link | título | preço | preço antigo | cupom`. Linhas inválidas voltam em `invalid`. */
export function parseLinks(text: string): { items: ParsedLine[]; invalid: string[]; extra: number } {
  const items: ParsedLine[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let extra = 0;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split("|").map((s) => s.trim());
    const url = parts[0];
    if (!isValidUrl(url)) { invalid.push(line.slice(0, 80)); continue; }
    if (seen.has(url)) continue;
    seen.add(url);
    if (items.length >= MAX_LINKS) { extra++; continue; }
    items.push({
      url,
      title: parts[1] || null,
      price: parseMoney(parts[2]),
      previous_price: parseMoney(parts[3]),
      coupon: parts[4] || null,
    });
  }
  return { items, invalid, extra };
}

export type PromoData = {
  title?: string | null; price?: number | null; previous_price?: number | null; coupon?: string | null;
  free_shipping?: boolean | null; marketplace?: string | null; link?: string | null; slogan?: string | null;
};

const STORE: Record<string, string> = {
  mercadolivre: "Mercado Livre", shopee: "Shopee", amazon: "Amazon", magalu: "Magalu", shein: "Shein",
};

export function placeholderValues(d: PromoData): Record<string, string> {
  const price = d.price != null ? brl(d.price) : "";
  const prev = d.price != null && d.previous_price && d.previous_price > d.price ? brl(d.previous_price) : "";
  const disc = d.price != null ? calcDiscount(d.price, d.previous_price) : null;
  const desconto = disc != null ? `-${Math.round(disc)}%` : "";
  let oferta = "";
  if (price) oferta = prev ? `Por ${price} (de ${prev}${desconto ? ` • ${desconto}` : ""})` : `Por ${price}`;
  return {
    titulo: d.title ?? "", oferta, preco: price, preco_antigo: prev, desconto,
    cupom: d.coupon ?? "", frete: d.free_shipping ? "Frete grátis" : "",
    loja: d.marketplace ? STORE[d.marketplace] ?? "" : "", slogan: d.slogan ?? "", link: d.link ?? "",
  };
}

/** Preenche o modelo. Linha com algum campo vazio é removida (nada é inventado). */
export function renderTemplate(body: string, d: PromoData): string {
  const v = placeholderValues(d);
  const out: string[] = [];
  for (const line of body.split(/\r?\n/)) {
    const keys = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
    if (keys.length && keys.some((k) => k in v && !v[k])) continue;
    out.push(line.replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)));
  }
  return out.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** Extrai um código tipo MLB123456789 (Mercado Livre) de um link, se houver. */
export function extractExternalId(url: string): string | null {
  const m = url.match(/MLB[-_]?(\d{6,})/i);
  return m ? `MLB${m[1]}` : null;
}
