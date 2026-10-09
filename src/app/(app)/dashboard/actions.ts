"use server";
import { revalidatePath } from "next/cache";
import { logActivity, requireUser, go } from "@/lib/session";

export async function toggleAutomation() {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from("profiles").select("automation_status").eq("id", user.id).single();
  const next = p?.automation_status === "running" ? "paused" : "running";
  const { error } = await supabase.from("profiles").update({ automation_status: next }).eq("id", user.id);
  if (error) go("/dashboard", "err", `Falha ao alterar a automação: ${error.message}`);
  await logActivity(supabase, user.id, next === "running" ? "automation.resumed" : "automation.paused");
  revalidatePath("/dashboard");
  go("/dashboard", "ok", next === "running" ? "Automação marcada como ATIVA." : "Automação pausada.");
}
