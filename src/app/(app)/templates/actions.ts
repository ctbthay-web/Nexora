"use server";
import { revalidatePath } from "next/cache";
import { go, requireUser } from "@/lib/session";

const BACK = "/templates";

export async function addTemplate(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!name || !body) go(BACK, "err", "Informe o nome e o texto do modelo.");
  if (!body.includes("{link}")) go(BACK, "err", "O modelo precisa conter {link}, senão a mensagem sai sem o link.");
  if (body.length > 1500) go(BACK, "err", "Modelo muito longo (máx. 1500 caracteres).");
  const { error } = await supabase.from("message_templates").insert({ user_id: user.id, name: name.slice(0, 80), body });
  if (error) go(BACK, "err", error.message);
  revalidatePath(BACK); go(BACK, "ok", "Modelo criado.");
}

export async function setDefaultTemplate(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  await supabase.from("message_templates").update({ is_default: false }).eq("user_id", user.id);
  const { error } = await supabase.from("message_templates").update({ is_default: true }).eq("id", id);
  if (error) go(BACK, "err", error.message);
  revalidatePath(BACK); go(BACK, "ok", "Modelo padrão atualizado.");
}

export async function deleteTemplate(formData: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("message_templates").delete().eq("id", String(formData.get("id")));
  if (error) go(BACK, "err", error.message);
  revalidatePath(BACK); go(BACK, "ok", "Modelo excluído.");
}

export async function addSlogan(formData: FormData) {
  const { supabase, user } = await requireUser();
  const text = String(formData.get("text") ?? "").trim();
  if (!text) go(BACK, "err", "Digite o slogan.");
  if (text.length > 120) go(BACK, "err", "Slogan muito longo (máx. 120).");
  const { error } = await supabase.from("slogans").insert({ user_id: user.id, text });
  if (error) go(BACK, "err", error.message);
  revalidatePath(BACK); go(BACK, "ok", "Slogan adicionado.");
}

export async function deleteSlogan(formData: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("slogans").delete().eq("id", String(formData.get("id")));
  if (error) go(BACK, "err", error.message);
  revalidatePath(BACK); go(BACK, "ok", "Slogan removido.");
}
