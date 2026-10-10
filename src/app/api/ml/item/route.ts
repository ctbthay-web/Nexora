import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMlToken, mlGet } from "@/lib/ml";

export const dynamic = "force-dynamic";

const HOSTS = [/(^|\.)mercadolivre\.com(\.br)?$/, /(^|\.)mercadolibre\.com$/, /(^|\.)meli\.la$/];
const okHost = (u: URL) => u.protocol === "https:" && HOSTS.some((r) => r.test(u.hostname));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

type Out = {
  title: string; price: number; original_price: number | null; image: string | null;
  free_shipping: boolean; category: string | null; permalink: string | null; source: "api" | "pagina";
};

/** Acha o código do anúncio (MLB123...) ou do catálogo (/p/MLB123...) no link. */
function ids(u: URL) {
  const wid = (u.searchParams.get("wid") ?? u.searchParams.get("item_id") ?? "").match(/MLB-?(\d+)/i)?.[1] ?? null;
  const cat = u.pathname.match(/\/p\/(MLB\d+)/i)?.[1]?.toUpperCase() ?? null;
  const inPath = cat ? null : u.pathname.match(/MLB-?(\d{6,})/i)?.[1] ?? null;
  const n = wid ?? inPath;
  return { item: n ? `MLB${n}` : null, cat };
}

async function viaApi(token: string | null, u: URL): Promise<Out | { error: string }> {
  const get = (p: string) => mlGet(token ?? "", p);
  const why = (r: { status: number; json: any }) => `O Mercado Livre respondeu ${r.status}: ${r.json?.message ?? r.json?.error ?? "sem detalhes"}`;
  let { item } = ids(u);
  const { cat } = ids(u);
  let lastErr: string | null = null;
  if (!item && cat) {
    // Página de catálogo (/p/MLB...): descobre um anúncio vendável desse produto.
    const p = await get(`/products/${cat}`);
    if (p.ok) {
      item = p.json?.buy_box_winner?.item_id ?? null;
      if (!item && p.json?.name && typeof p.json?.buy_box_winner?.price === "number") {
        const bb = p.json.buy_box_winner;
        return { title: p.json.name, price: bb.price, original_price: typeof bb.original_price === "number" && bb.original_price > bb.price ? bb.original_price : null, image: p.json.pictures?.[0]?.url?.replace(/^http:/, "https:") ?? null, free_shipping: bb.shipping?.free_shipping === true, category: null, permalink: null, source: "api" };
      }
    } else lastErr = `Produto do catálogo: ${why(p)}`;
    if (!item) {
      const it = await get(`/products/${cat}/items?limit=1`);
      if (it.ok) item = it.json?.results?.[0]?.item_id ?? it.json?.results?.[0]?.id ?? null;
      else if (!lastErr) lastErr = `Itens do catálogo: ${why(it)}`;
    }
    if (!item) {
      const s = await get(`/sites/MLB/search?product_id=${cat}&limit=1`);
      if (s.ok) item = s.json?.results?.[0]?.id ?? null;
      else if (!lastErr) lastErr = `Busca: ${why(s)}`;
    }
  }
  if (!item) return { error: lastErr ?? "Não achei o código do anúncio nesse link." };
  const r = await get(`/items/${item}`);
  if (!r.ok) return { error: why(r) };
  const j = r.json;
  if (typeof j?.title !== "string" || typeof j?.price !== "number") return { error: "O Mercado Livre não devolveu título e preço desse anúncio." };
  let category: string | null = null;
  if (j.category_id) { const c = await get(`/categories/${j.category_id}`); if (c.ok && typeof c.json?.name === "string") category = c.json.name; }
  const img = String(j.pictures?.[0]?.secure_url ?? j.secure_thumbnail ?? j.thumbnail ?? "").replace(/^http:\/\//, "https://");
  return {
    title: j.title, price: j.price,
    original_price: typeof j.original_price === "number" && j.original_price > j.price ? j.original_price : null,
    image: img || null, free_shipping: j.shipping?.free_shipping === true, category,
    permalink: typeof j.permalink === "string" ? j.permalink : null, source: "api",
  };
}

/** Plano B: lê os dados públicos da própria página do anúncio (JSON-LD). */
async function viaPage(u: URL): Promise<Out | { error: string }> {
  try {
    const res = await fetch(u, { headers: { "user-agent": UA, "accept-language": "pt-BR,pt;q=0.9" }, redirect: "follow", cache: "no-store" });
    if (!res.ok) return { error: `A página respondeu ${res.status}.` };
    if (!okHost(new URL(res.url))) return { error: "O link redirecionou para fora do Mercado Livre." };
    const html = await res.text();
    for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
      let d: any; try { d = JSON.parse(m[1]); } catch { continue; }
      for (const n of Array.isArray(d) ? d : d?.["@graph"] ?? [d]) {
        if (n?.["@type"] !== "Product") continue;
        const o = Array.isArray(n.offers) ? n.offers[0] : n.offers;
        const price = Number(o?.price ?? o?.lowPrice);
        if (typeof n.name === "string" && Number.isFinite(price) && price > 0) {
          const img = Array.isArray(n.image) ? n.image[0] : n.image;
          return { title: n.name, price, original_price: null, image: typeof img === "string" ? img.replace(/^http:\/\//, "https://") : null, free_shipping: false, category: null, permalink: res.url, source: "pagina" };
        }
      }
    }
    return { error: "Não encontrei os dados do produto na página." };
  } catch (e: any) { return { error: `Não consegui abrir a página: ${e?.message ?? "erro"}` }; }
}

export async function POST(req: NextRequest) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Faça login de novo." }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  let u: URL;
  try { u = new URL(String(body.url ?? "").trim()); } catch { return NextResponse.json({ error: "Cole o link completo do produto (começando com https://)." }, { status: 400 }); }
  if (!okHost(u)) return NextResponse.json({ error: "Use um link do Mercado Livre." }, { status: 400 });

  // Links curtos (meli.la, /sec/): segue o redirecionamento para achar o link real.
  if (/(^|\.)meli\.la$/.test(u.hostname) || /\/sec\//.test(u.pathname)) {
    try { const r = await fetch(u, { headers: { "user-agent": UA }, redirect: "follow", cache: "no-store" }); const f = new URL(r.url); if (okHost(f)) u = f; } catch {}
  }
  if (/^\/social\//.test(u.pathname)) return NextResponse.json({ error: "Esse link abre o seu perfil de afiliado, não um produto. Abra o produto no Mercado Livre e use o botão Compartilhar (ou copie o endereço da página do produto)." }, { status: 422 });
  const token = await getMlToken(supabase, user.id).catch(() => null);
  let r = await viaApi(token, u);
  let apiErr: string | null = null;
  if ("error" in r) { apiErr = r.error; r = await viaPage(u); }
  if ("error" in r) return NextResponse.json({ error: `${apiErr} ${r.error}`.trim() }, { status: 422 });
  return NextResponse.json({ ...r, permalink: r.permalink ?? u.toString(), shared: new URL(String(body.url).trim()).hostname.endsWith("meli.la") });
}
