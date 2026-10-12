"use server";
import { revalidatePath } from "next/cache";
import { go, requireUser } from "@/lib/session";
import { MARKETPLACES } from "@/lib/constants";

const BACK = "/cupons";

export async function addCoupon(formData: FormData) {
  const { supabase, user } = await requireUser();
  const code = String(formData.get("code") ?? "").trim();
  const mk = String(formData.get("marketplace") ?? "");
  const exp = String(formData.get("expires_on") ?? "");
  if (!code || code.length > 60) go(BACK, "err", "Informe o código do cupom (até 60 caracteres).");
  if (mk && !(mk in MARKETPLACES)) go(BACK, "err", "Loja inválida.");
  if (exp && !/^\d{4}-\d{2}-\d{2}$/.test(exp)) go(BACK, "err", "Data de validade inválida.");
  const { error } = await supabase.from("coupons").insert({
    user_id: user.id, code, marketplace: mk || null, expires_on: exp || null,
    description: String(formData.get("description") ?? "").trim().slice(0, 200) || null,
  });
  if (error) go(BACK, "err", error.message);
  revalidatePath(BACK); go(BACK, "ok", "Cupom cadastrado.");
}

export async function toggleCoupon(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id")); const active = formData.get("active") === "1";
  const { error } = await supabase.from("coupons").update({ active: !active }).eq("id", id);
  if (error) go(BACK, "err", error.message);
  revalidatePath(BACK); go(BACK, "ok", active ? "Cupom desativado." : "Cupom ativado.");
}

export async function deleteCoupon(formData: FormData) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("coupons").delete().eq("id", String(formData.get("id")));
  if (error) go(BACK, "err", error.message);
  revalidatePath(BACK); go(BACK, "ok", "Cupom excluído.");
}
