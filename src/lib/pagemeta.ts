import { detectMarketplace } from "./promo";
import { isValidUrl } from "./utils";

export type PageMeta = { title: string | null; price: number | null; image: string | null };

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

const toNum = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  if (typeof v === "string") {
    let s = v.replace(/[R$\s]/g, "");
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    const n = Number(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
  return null;
};

const metaContent = (html: string, key: string): string | null => {
  const re = new RegExp(`<meta[^>]+(?:property|name|itemprop)=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const c = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return c ? decode(c).trim() || null : null;
};

function walk(node: any, out: any[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return void node.forEach((n) => walk(n, out));
  const t = node["@type"];
  if (t === "Product" || (Array.isArray(t) && t.includes("Product"))) out.push(node);
  if (node["@graph"]) walk(node["@graph"], out);
}

/** Lê só o que a página pública declara (JSON-LD de produto e metatags). Nada é inventado: o que faltar fica null. */
export function extractMeta(html: string): PageMeta {
  let title: string | null = null, price: number | null = null, image: string | null = null;
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const b of blocks) {
    try {
      const prods: any[] = []; walk(JSON.parse(b[1]), prods);
      for (const p of prods) {
        if (!title && typeof p.name === "string") title = decode(p.name).trim() || null;
        if (!image) { const im = Array.isArray(p.image) ? p.image[0] : p.image; if (typeof im === "string") image = im; else if (im?.url) image = String(im.url); }
        if (price == null) {
          const o = Array.isArray(p.offers) ? p.offers[0] : p.offers;
          price = toNum(o?.price) ?? toNum(o?.lowPrice);
        }
      }
    } catch { /* JSON-LD inválido: ignora */ }
  }
  title ??= metaContent(html, "og:title");
  image ??= metaContent(html, "og:image");
  price ??= toNum(metaContent(html, "product:price:amount")) ?? toNum(metaContent(html, "price"));
  if (image && !isValidUrl(image)) image = null;
  return { title: title ? title.slice(0, 300) : null, price, image };
}

const MAX_BYTES = 1_500_000;

export type FetchResult = { ok: true; url: string; meta: PageMeta } | { ok: false; reason: string };

/** Busca UMA página pública de produto (sem login, sem cookies). Só lojas conhecidas; não tenta burlar bloqueios. */
export async function fetchProductMeta(url: string): Promise<FetchResult> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isValidUrl(current) || !current.startsWith("https://")) return { ok: false, reason: "link precisa ser https" };
    if (!detectMarketplace(current)) return { ok: false, reason: "loja não reconhecida" };
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "NexoraBot/1.0 (leitura de página pública de produto)", "accept-language": "pt-BR,pt;q=0.9", accept: "text/html" },
      });
    } catch { return { ok: false, reason: "não foi possível abrir a página (tempo esgotado ou rede)" }; }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, reason: "redirecionamento sem destino" };
      try { current = new URL(loc, current).toString(); } catch { return { ok: false, reason: "redirecionamento inválido" }; }
      continue;
    }
    if (res.status === 403 || res.status === 429) return { ok: false, reason: `a loja bloqueou a leitura automática (HTTP ${res.status}); nada foi coletado` };
    if (!res.ok) return { ok: false, reason: `a loja respondeu HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    const html = new TextDecoder("utf-8").decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf);
    return { ok: true, url: current, meta: extractMeta(html) };
  }
  return { ok: false, reason: "redirecionamentos demais" };
}
