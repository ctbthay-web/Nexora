"use server";
import { revalidatePath } from "next/cache";
import { MARKETPLACES } from "@/lib/constants";
import { go, logActivity, requireUser } from "@/lib/session";
import { ML_NEEDS_APP, getMlApp, getMlToken, mlGet } from "@/lib/ml";

/** Salva ID e chave da aplicação do Mercado Livre na conta do usuário (nunca devolvidos ao navegador). */
export async function saveMlApp(formData: FormData) {
  const { supabase, user } = await requireUser();
  const clientId = String(formData.get("client_id") ?? "").trim();
  const secret = String(formData.get("client_secret") ?? "").trim();
  if (!/^\d{6,20}$/.test(clientId)) go("/marketplaces", "err", "O ID da aplicação deve ter só números.");
  const { data: cur } = await supabase.from("ml_app").select("client_id,client_secret").eq("user_id", user.id).maybeSingle();
  const finalSecret = secret || cur?.client_secret || "";
  if (finalSecret.length < 10) go("/marketplaces", "err", "Informe a chave secreta (Client Secret) da aplicação.");
  const { error } = await supabase.from("ml_app").upsert({ user_id: user.id, client_id: clientId, client_secret: finalSecret, updated_at: new Date().toISOString() });
  if (error) go("/marketplaces", "err", `Não consegui salvar: ${error.message}`);
  if (cur && (cur.client_id !== clientId || cur.client_secret !== finalSecret)) await supabase.from("ml_tokens").delete().eq("user_id", user.id);
  await logActivity(supabase, user.id, "ml.credentials_saved", { title: "Mercado Livre" });
  revalidatePath("/marketplaces");
  go("/marketplaces", "ok", "Aplicação salva. Agora clique em Conectar Mercado Livre.");
}

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
  if (mp === "mercadolivre") {
    // Teste REAL: pergunta ao Mercado Livre quem é o usuário conectado.
    let err: string | null = null;
    let nick = "";
    if (!(await getMlApp(supabase, user.id))) err = ML_NEEDS_APP;
    else {
      try {
        const token = await getMlToken(supabase, user.id);
        if (!token) err = "Ainda não conectado. Clique em Conectar Mercado Livre.";
        else {
          const r = await mlGet(token, "/users/me");
          if (!r.ok) err = `O Mercado Livre respondeu ${r.status}: ${r.json?.message ?? "sem detalhes"}`;
          else nick = r.json?.nickname ?? "";
        }
      } catch (e: any) { err = e?.message ?? "Falha ao testar."; }
    }
    if (err) {
      await supabase.from("marketplace_connections").update({ status: "error", last_error: err }).eq("marketplace", mp);
      await logActivity(supabase, user.id, "marketplace.test_failed", { title: "Mercado Livre" });
      go("/marketplaces", "err", `Mercado Livre: ${err}`);
    }
    await supabase.from("marketplace_connections").update({ status: "configured", last_error: null, last_sync_at: new Date().toISOString() }).eq("marketplace", mp);
    await logActivity(supabase, user.id, "marketplace.checked", { title: "Mercado Livre" });
    go("/marketplaces", "ok", `Mercado Livre: conexão real funcionando${nick ? ` (conta ${nick})` : ""}.`);
  }
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

/** Salva App ID e Secret da API de afiliados da Shopee (a Secret nunca volta para o navegador). */
export async function saveShopeeApi(formData: FormData) {
  const { supabase, user } = await requireUser();
  const appId = String(formData.get("app_id") ?? "").trim();
  const secret = String(formData.get("app_secret") ?? "").trim();
  if (!/^[A-Za-z0-9_-]{4,40}$/.test(appId)) go("/marketplaces", "err", "App ID inválido: use só letras, números, - ou _ (sem espaços).");
  const { data: cur } = await supabase.from("shopee_api").select("app_secret").eq("user_id", user.id).maybeSingle();
  const finalSecret = secret || cur?.app_secret || "";
  if (finalSecret.length < 8 || finalSecret.length > 200 || /\s/.test(finalSecret)) go("/marketplaces", "err", "Informe a Secret da Shopee (sem espaços).");
  const { error } = await supabase.from("shopee_api").upsert({ user_id: user.id, app_id: appId, app_secret: finalSecret, updated_at: new Date().toISOString() });
  if (error) go("/marketplaces", "err", `Não consegui salvar: ${error.message}`);
  await logActivity(supabase, user.id, "shopee.credentials_saved", { title: "Shopee" });
  revalidatePath("/marketplaces");
  go("/marketplaces", "ok", "App ID e Secret da Shopee salvos. A busca de produtos da Shopee ainda será ligada na próxima etapa.");
}

export async function removeShopeeApi() {
  const { supabase, user } = await requireUser();
  await supabase.from("shopee_api").delete().eq("user_id", user.id);
  await logActivity(supabase, user.id, "shopee.credentials_removed", { title: "Shopee" });
  revalidatePath("/marketplaces");
  go("/marketplaces", "ok", "Credenciais da Shopee removidas.");
}
