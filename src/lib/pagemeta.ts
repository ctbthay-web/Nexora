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

type HtmlResult = { ok: true; url: string; html: string } | { ok: false; reason: string };

/** Baixa UMA página pública (sem login). Só lojas conhecidas; o cookie só vai para a loja dele; não tenta burlar bloqueios. */
async function fetchHtml(url: string, cookies?: Record<string, string>): Promise<HtmlResult> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    if (!isValidUrl(current) || !current.startsWith("https://")) return { ok: false, reason: "link precisa ser https" };
    const mk = detectMarketplace(current);
    if (!mk) return { ok: false, reason: "loja não reconhecida" };
    const ck = cookies?.[mk]; // o cookie só vai para a PRÓPRIA loja a que pertence
    let res: Response;
    try {
      res = await fetch(current, {
        redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(8000),
        headers: { "user-agent": "NexoraBot/1.0 (leitura de página pública de produto)", "accept-language": "pt-BR,pt;q=0.9", accept: "text/html", ...(ck ? { cookie: ck } : {}) },
      });
    } catch { return { ok: false, reason: "não foi possível abrir a página (tempo esgotado ou rede)" }; }
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) return { ok: false, reason: "redirecionamento sem destino" };
      try { current = new URL(loc, current).toString(); } catch { return { ok: false, reason: "redirecionamento inválido" }; }
      continue;
    }
    if (res.status === 403 || res.status === 429) return { ok: false, reason: `a loja bloqueou a leitura automática (HTTP ${res.status}); nada foi coletado${ck ? " (mesmo com o cookie)" : ""}` };
    if (!res.ok) return { ok: false, reason: `a loja respondeu HTTP ${res.status}` };
    const buf = await res.arrayBuffer();
    const html = new TextDecoder("utf-8").decode(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf);
    return { ok: true, url: current, html };
  }
  return { ok: false, reason: "redirecionamentos demais" };
}

/** Busca UMA página pública de produto. */
export async function fetchProductMeta(url: string, cookies?: Record<string, string>): Promise<FetchResult> {
  const r = await fetchHtml(url, cookies);
  return r.ok ? { ok: true, url: r.url, meta: extractMeta(r.html) } : r;
}

export type ListItem = { title: string; price: number; image: string | null; url: string; rating: number | null };

/** Lê os produtos que a página de resultados declara (JSON-LD). Só itens do Mercado Livre com título, preço e link. */
export function extractListing(html: string): ListItem[] {
  const out: ListItem[] = []; const seen = new Set<string>();
  for (const b of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const prods: any[] = []; walk(JSON.parse(b[1]), prods);
      for (const p of prods) {
        const o = Array.isArray(p.offers) ? p.offers[0] : p.offers;
        const url = typeof o?.url === "string" ? o.url.split("#")[0] : null;
        const price = toNum(o?.price);
        const title = typeof p.name === "string" ? decode(p.name).trim().slice(0, 300) : "";
        if (!url || !isValidUrl(url) || detectMarketplace(url) !== "mercadolivre" || price == null || !title || seen.has(url)) continue;
        seen.add(url);
        const im = Array.isArray(p.image) ? p.image[0] : p.image;
        const rt = Number(p.aggregateRating?.ratingValue);
        out.push({ title, price, url, image: typeof im === "string" && isValidUrl(im) ? im : null, rating: Number.isFinite(rt) && rt > 0 && rt <= 5 ? rt : null });
      }
    } catch { /* ignora */ }
  }
  return out;
}

const slug = (term: string) => term.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

/** Busca um termo na página pública de resultados do Mercado Livre (usa o cookie salvo, se houver). */
export async function fetchSearchItems(term: string, cookies?: Record<string, string>): Promise<{ ok: true; items: ListItem[] } | { ok: false; reason: string }> {
  const sl = slug(term);
  if (!sl) return { ok: false, reason: "termo inválido" };
  const r = await fetchHtml(`https://lista.mercadolivre.com.br/${sl}`, cookies);
  if (!r.ok) return r;
  const items = extractListing(r.html);
  if (items.length) return { ok: true, items };
  const title = (r.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 80);
  const ld = (r.html.match(/application\/ld\+json/gi) ?? []).length;
  return { ok: false, reason: `a página de "${term}" veio sem a lista de produtos (título: "${title || "sem título"}"; ${r.html.length} caracteres; ${ld} bloco(s) de dados; endereço final: ${r.url.slice(0, 80)})` };
}
