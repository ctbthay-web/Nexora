const API = "https://api.telegram.org";

export type TgResult<T = any> = { ok: true; result: T } | { ok: false; error: string; code?: number; retryAfter?: number };

async function call<T = any>(token: string, method: string, body?: Record<string, unknown>): Promise<TgResult<T>> {
  try {
    const res = await fetch(`${API}/bot${token}/${method}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(body ?? {}), cache: "no-store", signal: AbortSignal.timeout(20_000),
    });
    const j: any = await res.json().catch(() => null);
    if (j?.ok === true) return { ok: true, result: j.result as T };
    return { ok: false, error: String(j?.description ?? `Telegram respondeu ${res.status}`), code: j?.error_code ?? res.status, retryAfter: j?.parameters?.retry_after };
  } catch (e: any) {
    return { ok: false, error: `Falha de rede ao falar com o Telegram: ${e?.message ?? e}` };
  }
}

/** Valida o token de verdade. */
export const tgGetMe = (token: string) => call<{ id: number; username?: string; first_name?: string }>(token, "getMe");

/** Destino válido: @canal, @grupo ou id numérico (-100...). */
export const validDestination = (d: string) => /^@[A-Za-z][A-Za-z0-9_]{3,31}$/.test(d) || /^-?\d{5,20}$/.test(d);

/** O bot enxerga o destino e (em canal) é administrador com permissão de postar? */
export async function tgCheckDestination(token: string, botId: number, dest: string): Promise<{ ok: true; title: string } | { ok: false; error: string; kind: "invalid" | "attention" }> {
  const chat = await tgCall(token, "getChat", { chat_id: dest });
  if (!chat.ok) return { ok: false, error: friendly(chat.error), kind: "attention" };
  const type = chat.result.type as string;
  const title = chat.result.title ?? chat.result.username ?? dest;
  const m = await tgCall(token, "getChatMember", { chat_id: dest, user_id: botId });
  if (!m.ok) return { ok: false, error: friendly(m.error), kind: "attention" };
  const st = m.result.status as string;
  if (type === "channel") {
    if (st !== "administrator" && st !== "creator") return { ok: false, error: "O bot não é administrador do canal. Adicione o bot como administrador com permissão de publicar mensagens.", kind: "attention" };
    if (st === "administrator" && m.result.can_post_messages === false) return { ok: false, error: "O bot é administrador, mas sem a permissão “Publicar mensagens”.", kind: "attention" };
  } else if (st === "left" || st === "kicked") {
    return { ok: false, error: "O bot não está no grupo. Adicione o bot ao grupo.", kind: "attention" };
  } else if (st === "restricted" && m.result.can_send_messages === false) {
    return { ok: false, error: "O bot está restrito neste grupo e não pode enviar mensagens.", kind: "attention" };
  }
  return { ok: true, title: String(title) };
}
const tgCall = call;

export function friendly(err: string): string {
  if (/chat not found/i.test(err)) return "Destino não encontrado. Confira o @ do canal/grupo e se o bot foi adicionado a ele.";
  if (/unauthorized/i.test(err)) return "Token do bot inválido ou revogado.";
  if (/not enough rights|have no rights|need administrator/i.test(err)) return "O bot não tem permissão para publicar nesse destino.";
  if (/bot was kicked|bot is not a member/i.test(err)) return "O bot foi removido do destino. Adicione-o novamente.";
  return err;
}

/** Envia o post. Só devolve ok:true quando o Telegram confirmou com message_id. */
export async function tgSendPost(token: string, dest: string, caption: string, imageUrl: string | null): Promise<TgResult<{ message_id: number }>> {
  const text = caption.trim();
  if (!text) return { ok: false, error: "Legenda vazia." };
  if (imageUrl && text.length <= 1024) {
    const r = await call<{ message_id: number }>(token, "sendPhoto", { chat_id: dest, photo: imageUrl, caption: text });
    if (r.ok) return r;
    // Foto recusada (URL inacessível etc.): envia só o texto, sem esconder o motivo.
    if (!/wrong file identifier|failed to get http url content|wrong type of the web page content|image_process_failed|PHOTO_/i.test(r.error)) return r;
    const t = await call<{ message_id: number }>(token, "sendMessage", { chat_id: dest, text, disable_web_page_preview: false });
    return t.ok ? t : { ...t, error: `Foto recusada (${r.error}); texto também falhou: ${t.error}` };
  }
  if (imageUrl && text.length > 1024) {
    const p = await call<{ message_id: number }>(token, "sendPhoto", { chat_id: dest, photo: imageUrl });
    if (!p.ok) return p;
  }
  return call<{ message_id: number }>(token, "sendMessage", { chat_id: dest, text: text.slice(0, 4096), disable_web_page_preview: false });
}
