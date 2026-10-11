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

// ---------------------------------------------------------------------------------------------
// Telegram real
import { tgCheckDestination, tgGetMe, tgSendPost, validDestination, friendly } from "@/lib/telegram";

/** Valida o token chamando o Telegram (getMe) e só então salva. O token nunca volta para a tela. */
export async function saveTelegramBot(formData: FormData) {
  const { supabase, user } = await requireUser();
  const token = String(formData.get("bot_token") ?? "").trim();
  if (!/^\d{6,12}:[A-Za-z0-9_-]{30,}$/.test(token)) go("/canais", "err", "Token com formato inválido. Ele vem do @BotFather, parecido com 123456789:AA…");
  const me = await tgGetMe(token);
  if (!me.ok) go("/canais", "err", `O Telegram recusou o token: ${friendly(me.error)}`);
  const { error } = await supabase.from("telegram_bot").upsert({
    user_id: user.id, bot_token: token, bot_id: (me as any).result.id, bot_username: (me as any).result.username ?? null,
    validated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  });
  if (error) go("/canais", "err", `Não consegui salvar: ${error.message}`);
  await supabase.from("channels").update({ status: "not_connected", last_error: null }).eq("type", "telegram");
  await logActivity(supabase, user.id, "telegram.bot_saved", { title: `@${(me as any).result.username}` });
  revalidatePath("/canais");
  go("/canais", "ok", `Bot @${(me as any).result.username} validado. Agora use “Testar conexão” em cada canal.`);
}

export async function removeTelegramBot() {
  const { supabase, user } = await requireUser();
  await supabase.from("telegram_bot").delete().eq("user_id", user.id);
  await supabase.from("channels").update({ status: "awaiting_auth", last_error: "Bot desconectado." }).eq("type", "telegram");
  await logActivity(supabase, user.id, "telegram.bot_removed");
  revalidatePath("/canais");
  go("/canais", "ok", "Bot desconectado. Os envios do Telegram ficam parados até conectar de novo.");
}

/** Teste REAL: token válido + o bot enxerga o destino + tem permissão de postar. */
export async function testChannel(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const { data: ch } = await supabase.from("channels").select("id,name,type,destination").eq("id", id).single();
  if (!ch) go("/canais", "err", "Canal não encontrado.");
  const set = async (status: string, last_error: string | null) =>
    supabase.from("channels").update({ status, last_error, last_checked_at: new Date().toISOString() }).eq("id", id);
  if (ch!.type !== "telegram") { await set("not_connected", "Integração ainda não disponível para este tipo de canal."); go("/canais", "err", `${ch!.name}: só o Telegram está disponível por enquanto.`); }
  const { data: bot } = await supabase.from("telegram_bot").select("bot_token,bot_id").eq("user_id", user.id).maybeSingle();
  if (!bot) { await set("awaiting_auth", "Bot do Telegram ainda não configurado."); go("/canais", "err", "Configure primeiro o bot do Telegram (token do @BotFather)."); }
  const me = await tgGetMe(bot!.bot_token);
  if (!me.ok) { await set("invalid_credentials", friendly(me.error)); go("/canais", "err", `Token do bot inválido: ${friendly(me.error)}`); }
  if (!ch!.destination || !validDestination(ch!.destination)) { await set("needs_attention", "Destino ausente ou inválido."); go("/canais", "err", "Informe o destino como @canal ou ID numérico (ex.: -1001234567890)."); }
  const chk = await tgCheckDestination(bot!.bot_token, (me as any).result.id, ch!.destination!);
  if (!chk.ok) { await set("needs_attention", chk.error); await logActivity(supabase, user.id, "channel.test_failed", { title: ch!.name }); go("/canais", "err", `${ch!.name}: ${chk.error}`); }
  await set("connected", null);
  await logActivity(supabase, user.id, "channel.test_ok", { title: ch!.name });
  revalidatePath("/canais");
  go("/canais", "ok", `${ch!.name}: conexão real confirmada (${(chk as any).title}).`);
}

/** Publica de verdade uma mensagem de teste no canal (ação explícita do usuário). */
export async function sendChannelTest(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id"));
  const { data: ch } = await supabase.from("channels").select("name,type,destination").eq("id", id).single();
  const { data: bot } = await supabase.from("telegram_bot").select("bot_token").eq("user_id", user.id).maybeSingle();
  if (!ch || ch.type !== "telegram" || !ch.destination) go("/canais", "err", "Canal do Telegram sem destino.");
  if (!bot) go("/canais", "err", "Bot do Telegram não configurado.");
  const r = await tgSendPost(bot!.bot_token, ch!.destination!, "✅ Teste do Nexora: se você está lendo isto, a publicação automática funciona neste canal.", null);
  if (!r.ok) go("/canais", "err", `Não enviou: ${friendly(r.error)}`);
  await logActivity(supabase, user.id, "channel.test_message", { title: ch!.name });
  go("/canais", "ok", `Mensagem de teste publicada em ${ch!.name} (confirmada pelo Telegram, id ${(r as any).result.message_id}).`);
}

export async function updateChannelDestination(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const destination = String(formData.get("destination") ?? "").trim() || null;
  if (destination && !validDestination(destination)) go("/canais", "err", "Destino inválido. Use @canal ou ID numérico.");
  await supabase.from("channels").update({ destination, status: "not_connected", last_error: null }).eq("id", id);
  revalidatePath("/canais");
  go("/canais", "ok", "Destino salvo. Clique em Testar conexão.");
}
