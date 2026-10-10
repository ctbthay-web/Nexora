import type { SupabaseClient } from "@supabase/supabase-js";

export const ML_API = "https://api.mercadolibre.com";
export const ML_AUTH = "https://auth.mercadolivre.com.br/authorization";

export type MlApp = { clientId: string; clientSecret: string };

/** Credenciais da aplicação ML: as salvas pelo usuário na tela do app; senão (opcional) as variáveis de ambiente. */
export async function getMlApp(supabase: SupabaseClient, userId: string): Promise<MlApp | null> {
  const { data } = await supabase.from("ml_app").select("client_id,client_secret").eq("user_id", userId).maybeSingle();
  if (data?.client_id && data?.client_secret) return { clientId: data.client_id, clientSecret: data.client_secret };
  if (process.env.ML_CLIENT_ID && process.env.ML_CLIENT_SECRET) return { clientId: process.env.ML_CLIENT_ID, clientSecret: process.env.ML_CLIENT_SECRET };
  return null;
}

export const ML_NEEDS_APP = "Informe o ID e a chave da sua aplicação em Marketplaces → Mercado Livre.";

export type MlItem = {
  id: string; title: string; price: number; original_price: number | null;
  image: string | null; permalink: string; free_shipping: boolean;
};

/** Converte um resultado cru da API em item do app. Só usa campos que a API devolveu. */
export function mapMlItem(r: any): MlItem | null {
  if (!r || typeof r.id !== "string" || typeof r.title !== "string" || typeof r.price !== "number" || typeof r.permalink !== "string") return null;
  const img = String(r.secure_thumbnail ?? r.thumbnail ?? "").replace(/^http:\/\//, "https://");
  const orig = typeof r.original_price === "number" && r.original_price > r.price ? r.original_price : null;
  return {
    id: r.id, title: r.title, price: r.price, original_price: orig,
    image: img || null, permalink: r.permalink, free_shipping: r.shipping?.free_shipping === true,
  };
}

async function tokenRequest(app: MlApp, body: Record<string, string>) {
  const res = await fetch(`${ML_API}/oauth/token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: app.clientId, client_secret: app.clientSecret, ...body }),
    cache: "no-store",
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Mercado Livre recusou (${res.status}): ${j.error_description ?? j.message ?? j.error ?? "erro desconhecido"}`);
  return j as { access_token: string; refresh_token: string; expires_in: number; user_id?: number };
}

export async function exchangeCode(app: MlApp, code: string, redirectUri: string, codeVerifier?: string) {
  const body: Record<string, string> = { grant_type: "authorization_code", code, redirect_uri: redirectUri };
  if (codeVerifier) body.code_verifier = codeVerifier;
  return tokenRequest(app, body);
}

/** Devolve um access token válido (renova com o refresh token quando perto de expirar) ou null. */
export async function getMlToken(supabase: SupabaseClient, userId: string): Promise<string | null> {
  const { data: t } = await supabase.from("ml_tokens").select("*").eq("user_id", userId).maybeSingle();
  if (!t) return null;
  if (new Date(t.expires_at).getTime() - Date.now() > 60_000) return t.access_token;
  const app = await getMlApp(supabase, userId);
  if (!app) return null;
  const n = await tokenRequest(app, { grant_type: "refresh_token", refresh_token: t.refresh_token });
  await supabase.from("ml_tokens").update({
    access_token: n.access_token, refresh_token: n.refresh_token,
    expires_at: new Date(Date.now() + n.expires_in * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq("user_id", userId);
  return n.access_token;
}

export async function mlGet(token: string, path: string) {
  const res = await fetch(`${ML_API}${path}`, { headers: { authorization: `Bearer ${token}`, accept: "application/json" }, cache: "no-store" });
  const j: any = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json: j };
}

export async function searchMl(token: string, q: string): Promise<{ items: MlItem[] } | { error: string }> {
  const r = await mlGet(token, `/sites/MLB/search?q=${encodeURIComponent(q)}&limit=24`);
  if (!r.ok) return { error: `O Mercado Livre respondeu ${r.status}: ${r.json?.message ?? r.json?.error ?? "sem detalhes"}` };
  const items = (Array.isArray(r.json?.results) ? r.json.results : []).map(mapMlItem).filter(Boolean) as MlItem[];
  return { items };
}
