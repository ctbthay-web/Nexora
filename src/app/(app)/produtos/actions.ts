"use server";
import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { go, logActivity, requireUser } from "@/lib/session";
import { MARKETPLACES } from "@/lib/constants";
import { isValidUrl, parseMoney, zonedToUtc } from "@/lib/utils";
import { queueCaption } from "@/lib/gemini";
import { detectMarketplace, extractExternalId } from "@/lib/promo";
import { fetchProductMeta } from "@/lib/pagemeta";
import { createHash } from "node:crypto";
import { decryptText } from "@/lib/crypto";

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

/** Remove os itens de demonstração (dados fictícios) antigos. O Nexora não cria mais dados de exemplo. */
export async function deleteDemos() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase.from("products").delete().eq("is_demo", true).select("id");
  if (error) go("/produtos", "err", error.message);
  await logActivity(supabase, user.id, "demo.deleted", { count: data?.length ?? 0 });
  revalidatePath("/produtos");
  go("/produtos", "ok", `${data?.length ?? 0} produto(s) de demonstração excluído(s).`);
}

export async function enqueue(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const channelId = String(formData.get("channel_id") ?? "");
  const when = String(formData.get("scheduled_for") ?? "");
  if (!channelId) go("/produtos", "err", "Escolha um canal.");
  if (!when) go("/produtos", "err", "Informe data e hora do agendamento.");

  const [{ data: p }, { data: ch }, { data: prof }] = await Promise.all([
    supabase.from("products").select("title,status,affiliate_url,affiliate_verified,promo_text,price,previous_price,coupon,free_shipping,shipping_info,shipping_coupon").eq("id", id).single(),
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
    caption: queueCaption({ ...(p as any), affiliate_url: p!.affiliate_url! }),
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

/** Importa produtos colando links públicos: lê título, preço e imagem da página (sem login, sem cookies, sem API). */
export async function importByLinks(formData: FormData) {
  const { supabase, user } = await requireUser();
  const links = Array.from(new Set(String(formData.get("links") ?? "").split(/\s+/).map((x) => x.trim()).filter(Boolean))).slice(0, 15);
  if (!links.length) go("/produtos", "err", "Cole ao menos um link de produto (um por linha).");
  const { data: ckRows } = await supabase.from("session_cookies").select("marketplace,cookie_enc");
  const cookies: Record<string, string> = {};
  for (const r of ckRows ?? []) { const dc = decryptText(r.cookie_enc); if (dc) cookies[r.marketplace] = dc; }
  let ok = 0; const problems: string[] = [];
  for (const link of links) {
    const mk = detectMarketplace(link);
    if (!mk) { problems.push("loja não reconhecida"); continue; }
    const r = await fetchProductMeta(link, cookies);
    if (!r.ok) { problems.push(r.reason); continue; }
    const { title, price, image } = r.meta;
    if (!title || price == null) { problems.push("a página não trouxe título e preço legíveis"); continue; }
    const ext = extractExternalId(r.url) ?? extractExternalId(link) ?? `url-${createHash("sha1").update(r.url).digest("hex").slice(0, 20)}`;
    const { data, error } = await supabase.from("products").upsert({
      user_id: user.id, marketplace: mk, external_id: ext, title, price, image_url: image, original_url: r.url,
      source: "api", is_demo: false, status: "found", affiliate_verified: false, data_updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,marketplace,external_id", ignoreDuplicates: true }).select("id");
    if (error) { problems.push(error.message); continue; }
    if (data && data.length) ok++; else problems.push("já estava cadastrado");
  }
  await logActivity(supabase, user.id, "product.imported_links", { title: "importação por link", ok, problems: problems.length });
  revalidatePath("/produtos");
  const tail = problems.length ? ` Não importados: ${Array.from(new Set(problems)).slice(0, 3).join("; ")}.` : "";
  go("/produtos", ok ? "ok" : "err", `${ok} produto(s) importado(s).${tail} O link de afiliado continua sendo seu: confirme em Editar antes de publicar.`);
}
