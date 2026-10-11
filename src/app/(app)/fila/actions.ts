"use server";
import { revalidatePath } from "next/cache";
import { go, logActivity, requireUser } from "@/lib/session";
import { publishDue } from "@/lib/publisher";

export async function cancelQueueItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const { data: item } = await supabase.from("publish_queue").select("product_id,status").eq("id", id).single();
  if (!item) go("/fila", "err", "Item não encontrado.");
  if (item!.status !== "pending") go("/fila", "err", "Só itens pendentes podem ser cancelados.");
  const { error } = await supabase.from("publish_queue").update({ status: "canceled" }).eq("id", id);
  if (error) go("/fila", "err", error.message);
  const { count } = await supabase.from("publish_queue").select("id", { count: "exact", head: true })
    .eq("product_id", item!.product_id).eq("status", "pending");
  if (!count) await supabase.from("products").update({ status: "approved" }).eq("id", item!.product_id);
  await logActivity(supabase, user.id, "queue.canceled", { id });
  revalidatePath("/fila");
  go("/fila", "ok", "Item cancelado; produto voltou para Aprovado.");
}

export async function saveQueueCaption(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const caption = String(formData.get("caption") ?? "").trim();
  if (!caption) go("/fila", "err", "A legenda não pode ficar vazia.");
  if (caption.length > 4000) go("/fila", "err", "Legenda muito longa (máx. 4000 caracteres).");
  const { data, error } = await supabase.from("publish_queue").update({ caption, updated_at: new Date().toISOString() }).eq("id", id).eq("status", "pending").select("id");
  if (error) go("/fila", "err", error.message);
  if (!data?.length) go("/fila", "err", "Só itens pendentes podem ser editados.");
  revalidatePath("/fila");
  go("/fila", "ok", "Legenda atualizada.");
}

/** Publica agora um item (ignora o horário e a pausa; ação explícita do usuário). */
export async function sendNow(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const r = await publishDue(supabase, { userId: user.id, ids: [id], limit: 1 });
  revalidatePath("/fila");
  if (r.sent) go("/fila", "ok", "Publicado e confirmado pelo Telegram.");
  go("/fila", "err", r.messages[0] ?? "Não foi possível publicar agora.");
}

export async function retryItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const { data: it } = await supabase.from("publish_queue").select("product_id,status").eq("id", id).single();
  if (!it || it.status !== "failed") go("/fila", "err", "Só itens com falha podem ser reenviados.");
  const { error } = await supabase.from("publish_queue").update({
    status: "pending", attempts: 0, last_error: null, next_attempt_at: null, scheduled_for: new Date().toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", id);
  if (error) go("/fila", "err", error.message);
  await supabase.from("products").update({ status: "queued" }).eq("id", it!.product_id);
  await logActivity(supabase, user.id, "queue.retry", { id });
  revalidatePath("/fila");
  go("/fila", "ok", "Item recolocado na fila para nova tentativa.");
}
