"use server";
import { revalidatePath } from "next/cache";
import { go, logActivity, requireUser } from "@/lib/session";
import { isValidUrl } from "@/lib/utils";

/** Salva um resultado real do Mercado Livre como produto. Não cria link de afiliado: você cola o seu depois. */
export async function saveFromMl(formData: FormData) {
  const { supabase, user } = await requireUser();
  const q = String(formData.get("q") ?? "");
  const back = `/buscar?q=${encodeURIComponent(q)}`;
  const id = String(formData.get("id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const price = Number(formData.get("price"));
  const orig = Number(formData.get("original_price"));
  const permalink = String(formData.get("permalink") ?? "");
  const image = String(formData.get("image") ?? "") || null;
  const free = formData.get("free_shipping") === "1";
  if (!id || !title || !Number.isFinite(price) || price < 0 || !isValidUrl(permalink)) go(back, "err", "Dados do produto inválidos.");
  if (image && !isValidUrl(image)) go(back, "err", "Imagem inválida.");

  const { data: dup } = await supabase.from("products").select("id").eq("original_url", permalink).limit(1);
  if (dup && dup.length > 0) go(back, "err", "Esse produto já está na sua lista.");

  const { error } = await supabase.from("products").insert({
    user_id: user.id, marketplace: "mercadolivre", external_id: id, title, price,
    previous_price: Number.isFinite(orig) && orig > price ? orig : null,
    image_url: image, original_url: permalink, free_shipping: free ? true : null,
    source: "api", status: "found", data_updated_at: new Date().toISOString(),
  });
  if (error) go(back, "err", `Erro ao salvar: ${error.message}`);
  await logActivity(supabase, user.id, "product.imported", { title, source: "mercadolivre" });
  revalidatePath("/produtos");
  go(back, "ok", "Salvo em Produtos. Abra Editar para colar o seu link de afiliado.");
}
