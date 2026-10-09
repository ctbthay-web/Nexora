"use server";
import { revalidatePath } from "next/cache";
import { CHANNEL_TYPES } from "@/lib/constants";
import { go, logActivity, requireUser } from "@/lib/session";

export async function addChannel(formData: FormData) {
  const { supabase, user } = await requireUser();
  const type = String(formData.get("type"));
  const name = String(formData.get("name") ?? "").trim();
  const destination = String(formData.get("destination") ?? "").trim() || null;
  if (!(type in CHANNEL_TYPES)) go("/canais", "err", "Tipo de canal inválido.");
  if (!name) go("/canais", "err", "Informe um nome para o canal.");
  const { error } = await supabase.from("channels").insert({ user_id: user.id, type, name, destination });
  if (error) go("/canais", "err", error.message);
  await logActivity(supabase, user.id, "channel.created", { title: name });
  revalidatePath("/canais");
  go("/canais", "ok", "Canal cadastrado.");
}

export async function toggleChannel(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const on = formData.get("enabled") === "true";
  await supabase.from("channels").update({ enabled: !on }).eq("id", id);
  revalidatePath("/canais");
  go("/canais", "ok", on ? "Canal desativado." : "Canal ativado.");
}

export async function deleteChannel(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const { count } = await supabase.from("publish_queue").select("id", { count: "exact", head: true })
    .eq("channel_id", id).eq("status", "pending");
  if (count) go("/canais", "err", "Há itens pendentes na fila para este canal. Cancele-os antes.");
  const { error } = await supabase.from("channels").delete().eq("id", id);
  if (error) go("/canais", "err", error.message);
  await logActivity(supabase, user.id, "channel.deleted", { id });
  revalidatePath("/canais");
  go("/canais", "ok", "Canal removido.");
}
