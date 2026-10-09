"use server";
import { revalidatePath } from "next/cache";
import { go, logActivity, requireUser } from "@/lib/session";

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
