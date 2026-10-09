"use server";
import { revalidatePath } from "next/cache";
import { MARKETPLACES } from "@/lib/constants";
import { go, logActivity, requireUser } from "@/lib/session";

export async function saveMarketplace(formData: FormData) {
  const { supabase, user } = await requireUser();
  const mp = String(formData.get("marketplace"));
  if (!(mp in MARKETPLACES)) go("/marketplaces", "err", "Marketplace inválido.");
  const affiliate = String(formData.get("affiliate_id") ?? "").trim() || null;
  const enabled = formData.get("enabled") === "on";
  const status = affiliate ? "configured" : "not_configured";
  const { error } = await supabase.from("marketplace_connections")
    .update({ affiliate_id: affiliate, enabled, status, last_error: null }).eq("marketplace", mp);
  if (error) go("/marketplaces", "err", error.message);
  await logActivity(supabase, user.id, "marketplace.saved", { title: MARKETPLACES[mp as keyof typeof MARKETPLACES].label, enabled });
  revalidatePath("/marketplaces");
  go("/marketplaces", "ok", "Configuração salva.");
}

/**
 * Fase 1: NÃO existe chamada à API do marketplace ainda (Fase 2).
 * O "teste" só verifica se a configuração está completa e diz isso com clareza.
 */
export async function testMarketplace(formData: FormData) {
  const { supabase, user } = await requireUser();
  const mp = String(formData.get("marketplace"));
  const { data: c } = await supabase.from("marketplace_connections").select("affiliate_id").eq("marketplace", mp).single();
  const label = MARKETPLACES[mp as keyof typeof MARKETPLACES]?.label ?? mp;
  if (!c?.affiliate_id) {
    await supabase.from("marketplace_connections").update({ status: "error", last_error: "Identificador de afiliado não informado." }).eq("marketplace", mp);
    await logActivity(supabase, user.id, "marketplace.test_failed", { title: label });
    go("/marketplaces", "err", `${label}: falta informar o identificador de afiliado.`);
  }
  await supabase.from("marketplace_connections").update({ status: "configured", last_error: null }).eq("marketplace", mp);
  await logActivity(supabase, user.id, "marketplace.checked", { title: label });
  go("/marketplaces", "ok", `${label}: configuração local completa. A conexão real com a API só poderá ser testada na Fase 2.`);
}
