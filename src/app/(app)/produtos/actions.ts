"use server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { go, logActivity, requireUser } from "@/lib/session";
import { MARKETPLACES } from "@/lib/constants";
import { isValidUrl, parseMoney, zonedToUtc } from "@/lib/utils";

const str = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};

export async function saveProduct(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = str(formData, "id");
  const back = id ? `/produtos/${id}` : "/produtos/novo";

  const title = str(formData, "title");
  const marketplace = str(formData, "marketplace");
  const price = parseMoney(formData.get("price"));
  const previous = parseMoney(formData.get("previous_price"));
  const originalUrl = str(formData, "original_url");
  const affiliateUrl = str(formData, "affiliate_url");
  const imageUrl = str(formData, "image_url");
  const rating = parseMoney(formData.get("rating"));
  const verified = formData.get("affiliate_verified") === "on";

  if (!title) go(back, "err", "Informe o nome do produto.");
  if (!marketplace || !(marketplace in MARKETPLACES)) go(back, "err", "Escolha um marketplace válido.");
  if (price === null) go(back, "err", "Informe um preço válido.");
  if (originalUrl && !isValidUrl(originalUrl)) go(back, "err", "Link original inválido (use http:// ou https://).");
  if (affiliateUrl && !isValidUrl(affiliateUrl)) go(back, "err", "Link de afiliado inválido.");
  if (imageUrl && !isValidUrl(imageUrl)) go(back, "err", "URL da imagem inválida.");
  if (rating !== null && rating > 5) go(back, "err", "Avaliação deve ser de 0 a 5.");
  if (verified && !affiliateUrl) go(back, "err", "Para confirmar o link de afiliado, preencha o link.");
  if (previous !== null && previous <= price!) go(back, "err", "O preço anterior deve ser maior que o atual (ou deixe em branco).");

  // Possível duplicado pelo link original
  if (originalUrl) {
    let q = supabase.from("products").select("id,title").eq("original_url", originalUrl).limit(1);
    if (id) q = q.neq("id", id);
    const { data: dup } = await q;
    if (dup && dup.length > 0) go(back, "err", `Possível duplicado: já existe "${dup[0].title}" com esse link.`);
  }

  const row = {
    title: title!, marketplace: marketplace!, price: price!, previous_price: previous,
    original_url: originalUrl, affiliate_url: affiliateUrl, affiliate_verified: verified && !!affiliateUrl,
    image_url: imageUrl, category: str(formData, "category"), coupon: str(formData, "coupon"),
    rating, shipping_info: str(formData, "shipping_info"), shipping_coupon: str(formData, "shipping_coupon"), free_shipping: formData.get("free_shipping") === "on" ? true : null,
    promo_text: str(formData, "promo_text"), data_updated_at: new Date().toISOString(),
  };

  if (id) {
    const { error } = await supabase.from("products").update(row).eq("id", id);
    if (error) go(back, "err", `Erro ao salvar: ${error.message}`);
    await logActivity(supabase, user.id, "product.updated", { title });
    revalidatePath("/produtos");
    go("/produtos", "ok", "Produto atualizado.");
  }
  const { error } = await supabase.from("products").insert({
    ...row, user_id: user.id, external_id: randomUUID(), source: "manual",
  });
  if (error) go(back, "err", `Erro ao salvar: ${error.message}`);
  await logActivity(supabase, user.id, "product.created", { title });
  revalidatePath("/produtos");
  go("/produtos", "ok", "Produto cadastrado.");
}

export async function setStatus(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!["approved", "rejected", "found"].includes(status)) go("/produtos", "err", "Status inválido.");
  const { data: p } = await supabase.from("products").select("title,status").eq("id", id).single();
  if (p && ["queued", "published"].includes(p.status)) go("/produtos", "err", "Produto na fila/publicado: cancele o item da fila antes.");
  const { error } = await supabase.from("products").update({ status }).eq("id", id);
  if (error) go("/produtos", "err", error.message);
  await logActivity(supabase, user.id, `product.${status}`, { title: p?.title });
  revalidatePath("/produtos");
  go("/produtos", "ok", status === "approved" ? "Produto aprovado." : status === "rejected" ? "Produto rejeitado." : "Produto reaberto.");
}

export async function toggleFavorite(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const fav = formData.get("fav") === "true";
  await supabase.from("products").update({ favorite: !fav }).eq("id", id);
  revalidatePath("/produtos");
  go("/produtos", "ok", fav ? "Removido dos favoritos." : "Adicionado aos favoritos.");
}

export async function deleteProduct(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const { data: p } = await supabase.from("products").select("title").eq("id", id).single();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) go("/produtos", "err", error.message);
  await logActivity(supabase, user.id, "product.deleted", { title: p?.title });
  revalidatePath("/produtos");
  go("/produtos", "ok", "Produto excluído.");
}

export async function duplicateProduct(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const { data: p } = await supabase.from("products").select("*").eq("id", id).single();
  if (!p) go("/produtos", "err", "Produto não encontrado.");
  const { id: _i, created_at: _c, discount_pct: _d, ...rest } = p as any;
  const { error } = await supabase.from("products").insert({
    ...rest, user_id: user.id, external_id: randomUUID(), title: `${p!.title} (cópia)`,
    original_url: null, status: "found", favorite: false,
  });
  if (error) go("/produtos", "err", error.message);
  await logActivity(supabase, user.id, "product.duplicated", { title: p!.title });
  revalidatePath("/produtos");
  go("/produtos", "ok", "Produto duplicado (sem link original, para evitar conflito de duplicidade).");
}

/** Dados de DEMONSTRAÇÃO, claramente marcados. Sem link de afiliado: não podem ser publicados. */
export async function loadDemo() {
  const { supabase, user } = await requireUser();
  const demo = [
    ["shopee", "Fone Bluetooth sem fio", 59.9, 99.9, "Eletrônicos"],
    ["mercadolivre", "Panela antiaderente 24cm", 74.5, 119.0, "Casa"],
    ["amazon", "Teclado mecânico compacto", 189.0, 249.0, "Informática"],
    ["magalu", "Liquidificador 700W", 129.9, null, "Utilidades"],
    ["shein", "Conjunto de pijama feminino", 49.9, 79.9, "Moda"],
    ["shopee", "Organizador de gavetas (kit 6)", 24.9, 39.9, "Casa"],
  ] as const;
  const rows = demo.map(([marketplace, title, price, previous, category]) => ({
    user_id: user.id, marketplace, external_id: `demo-${randomUUID()}`, title: `[DEMO] ${title}`,
    price, previous_price: previous, category, source: "demo", is_demo: true,
    promo_text: "Dados fictícios de demonstração.",
  }));
  const { error } = await supabase.from("products").insert(rows);
  if (error) go("/produtos", "err", error.message);
  await logActivity(supabase, user.id, "demo.loaded", { count: rows.length });
  revalidatePath("/produtos");
  go("/produtos", "ok", "6 produtos de DEMONSTRAÇÃO criados (dados fictícios).");
}

export async function enqueue(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const channelId = String(formData.get("channel_id") ?? "");
  const when = String(formData.get("scheduled_for") ?? "");
  if (!channelId) go("/produtos", "err", "Escolha um canal.");
  if (!when) go("/produtos", "err", "Informe data e hora do agendamento.");

  const [{ data: p }, { data: ch }, { data: prof }] = await Promise.all([
    supabase.from("products").select("title,status,affiliate_url,affiliate_verified").eq("id", id).single(),
    supabase.from("channels").select("name,enabled").eq("id", channelId).single(),
    supabase.from("profiles").select("timezone").eq("id", user.id).single(),
  ]);
  if (!p) go("/produtos", "err", "Produto não encontrado.");
  if (p!.status !== "approved") go("/produtos", "err", "Aprove o produto antes de enfileirar.");
  if (!isValidUrl(p!.affiliate_url) || !p!.affiliate_verified)
    go("/produtos", "err", "Sem link de afiliado confirmado. Edite o produto, cole o link gerado no seu programa e marque como confirmado.");
  if (!ch || !ch.enabled) go("/produtos", "err", "Canal inexistente ou desativado.");

  const at = zonedToUtc(when, prof?.timezone ?? "America/Sao_Paulo");
  if (Number.isNaN(at.getTime())) go("/produtos", "err", "Data inválida.");

  const { error } = await supabase.from("publish_queue").insert({
    user_id: user.id, product_id: id, channel_id: channelId, scheduled_for: at.toISOString(),
  });
  if (error) {
    if (error.code === "23505") go("/produtos", "err", "Este produto já está na fila (ou foi enviado) para esse canal.");
    go("/produtos", "err", error.message);
  }
  await supabase.from("products").update({ status: "queued" }).eq("id", id);
  await logActivity(supabase, user.id, "queue.added", { title: p!.title, channel: ch!.name });
  revalidatePath("/produtos");
  go("/fila", "ok", "Produto agendado na fila.");
}
