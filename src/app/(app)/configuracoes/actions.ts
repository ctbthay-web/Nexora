"use server";
import { revalidatePath } from "next/cache";
import { TIMEZONES } from "@/lib/constants";
import { go, logActivity, requireUser } from "@/lib/session";

export async function saveSettings(formData: FormData) {
  const { supabase, user } = await requireUser();
  const display_name = String(formData.get("display_name") ?? "").trim() || null;
  const timezone = String(formData.get("timezone"));
  const brand_color = String(formData.get("brand_color"));
  if (!TIMEZONES.includes(timezone)) go("/configuracoes", "err", "Fuso horário inválido.");
  if (!/^#[0-9a-fA-F]{6}$/.test(brand_color)) go("/configuracoes", "err", "Cor inválida.");
  const { error } = await supabase.from("profiles").update({ display_name, timezone, brand_color }).eq("id", user.id);
  if (error) go("/configuracoes", "err", error.message);
  await logActivity(supabase, user.id, "settings.saved");
  revalidatePath("/", "layout");
  go("/configuracoes", "ok", "Configurações salvas.");
}
