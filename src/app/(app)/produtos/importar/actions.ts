"use server";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { logActivity, requireUser } from "@/lib/session";

export type ImportItem = { title: string; price: number; previous_price: number | null; image: string | null; url: string };

const okUrl = (v: string, ml: boolean) => {
  try {
    const u = new URL(v);
    if (u.protocol !== "https:") return false;
    return ml ? /(^|\.)mercadolivre\.com\.br$/.test(u.hostname) : true;
  } catch { return false; }
};

/** Salva ofertas lidas da página do Mercado Livre. Só grava o que veio da página; sem link de afiliado. */
export async function importProducts(raw: ImportItem[]): Promise<{ saved: number; skipped: number; error?: string }> {
  const { supabase, user } = await requireUser();
  const items = (Array.isArray(raw) ? raw : []).slice(0, 60).map((r) => ({
    title: String(r?.title ?? "").trim().slice(0, 300),
    price: Number(r?.price),
    previous: r?.previous_price == null ? null : Number(r.previous_price),
    image: r?.image ? String(r.image) : null,
    url: String(r?.url ?? ""),
  })).filter((r) => r.title && Number.isFinite(r.price) && r.price > 0 && okUrl(r.url, true));
  if (items.length === 0) return { saved: 0, skipped: 0, error: "Nenhum produto válido para salvar." };

  const { data: existing } = await supabase.from("products").select("original_url").in("original_url", items.map((i) => i.url));
  const have = new Set((existing ?? []).map((e: any) => e.original_url));
  const seen = new Set<string>();
  const rows = items.filter((i) => !have.has(i.url) && !seen.has(i.url) && seen.add(i.url)).map((i) => ({
    user_id: user.id, marketplace: "mercadolivre", external_id: randomUUID(), title: i.title, price: i.price,
    previous_price: i.previous != null && Number.isFinite(i.previous) && i.previous > i.price ? i.previous : null,
    image_url: i.image && okUrl(i.image, false) ? i.image : null, original_url: i.url,
    source: "manual", status: "found", data_updated_at: new Date().toISOString(),
  }));
  if (rows.length > 0) {
    const { error } = await supabase.from("products").insert(rows);
    if (error) return { saved: 0, skipped: items.length, error: `Erro ao salvar: ${error.message}` };
    await logActivity(supabase, user.id, "product.imported", { title: `${rows.length} ofertas do Mercado Livre`, source: "pagina" });
    revalidatePath("/produtos");
  }
  return { saved: rows.length, skipped: items.length - rows.length };
}
