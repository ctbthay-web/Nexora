"use server";
import { revalidatePath } from "next/cache";
import { go, logActivity, requireUser } from "@/lib/session";
import { DEFAULT_TEMPLATE, detectMarketplace, extractExternalId, parseLinks, renderTemplate } from "@/lib/promo";
import { tgSendPost, friendly } from "@/lib/telegram";

export type GenItem = {
  url: string; link: string; marketplace: string | null; title: string | null; price: number | null;
  previous_price: number | null; coupon: string | null; free_shipping: boolean; image_url: string | null;
  affiliate_ok: boolean; from_product: boolean; message: string; sent_at?: string | null; sent_to?: string | null;
};

export async function generatePromos(formData: FormData) {
  const { supabase, user } = await requireUser();
  const text = String(formData.get("links") ?? "");
  const { items, invalid, extra } = parseLinks(text);
  if (!items.length) go("/promocoes", "err", "Cole pelo menos um link válido (começando com https://).");
  const templateId = String(formData.get("template") ?? "");
  const useSlogan = formData.get("use_slogan") === "on";
  const useCoupons = formData.get("use_coupons") === "on";
  const mine = formData.get("my_links") === "on";

  const [tpl, slogans, coupons, products] = await Promise.all([
    templateId ? supabase.from("message_templates").select("name,body").eq("id", templateId).maybeSingle() : Promise.resolve({ data: null }),
    useSlogan ? supabase.from("slogans").select("text") : Promise.resolve({ data: [] as any[] }),
    useCoupons ? supabase.from("coupons").select("marketplace,code,expires_on").eq("active", true) : Promise.resolve({ data: [] as any[] }),
    supabase.from("products").select("title,price,previous_price,coupon,free_shipping,image_url,marketplace,external_id,original_url,affiliate_url,affiliate_verified").eq("is_demo", false).limit(2000),
  ]);
  const body = tpl.data?.body ?? DEFAULT_TEMPLATE;
  const today = new Date().toISOString().slice(0, 10);
  const slogList: string[] = (slogans.data ?? []).map((s: any) => s.text);
  const cpList = ((coupons.data ?? []) as any[]).filter((c) => !c.expires_on || c.expires_on >= today);
  const prods = (products.data ?? []) as any[];

  const out: GenItem[] = items.map((it, i) => {
    const id = extractExternalId(it.url);
    const p = prods.find((x) => x.affiliate_url === it.url || x.original_url === it.url
      || (id && (extractExternalId(x.original_url ?? "") === id || x.external_id === id)));
    const mk = detectMarketplace(it.url) ?? p?.marketplace ?? null;
    const verified = !!(p?.affiliate_verified && p?.affiliate_url);
    const link = verified ? p.affiliate_url : it.url;
    const title = it.title ?? p?.title ?? null;
    const price = it.price ?? (p ? Number(p.price) : null);
    const previous = it.previous_price ?? (p?.previous_price != null ? Number(p.previous_price) : null);
    const cp = it.coupon ?? p?.coupon ?? cpList.find((c) => c.marketplace === mk || !c.marketplace)?.code ?? null;
    const free = !!p?.free_shipping;
    const slogan = slogList.length ? slogList[Math.floor(Math.random() * slogList.length)] : null;
    const message = renderTemplate(body, { title, price, previous_price: previous, coupon: cp, free_shipping: free, marketplace: mk, link, slogan });
    return {
      url: it.url, link, marketplace: mk, title, price, previous_price: previous, coupon: cp, free_shipping: free,
      image_url: p?.image_url ?? null, affiliate_ok: verified || mine, from_product: !!p, message,
    };
  });

  const { data, error } = await supabase.from("generations").insert({
    user_id: user.id, template_name: tpl.data?.name ?? "Modelo padrão", items: out,
  }).select("id").single();
  if (error || !data) go("/promocoes", "err", error?.message ?? "Não foi possível salvar a geração.");
  await logActivity(supabase, user.id, "promo.generated", { count: out.length });
  revalidatePath("/promocoes");
  const notes = [invalid.length ? `${invalid.length} linha(s) inválida(s) ignorada(s)` : "", extra ? `${extra} link(s) passaram do limite de 30` : ""].filter(Boolean).join("; ");
  go(`/promocoes/${data!.id}`, "ok", `${out.length} mensagem(ns) gerada(s).${notes ? " " + notes + "." : ""}`);
}

export async function saveGenMessage(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id")); const idx = Number(formData.get("idx"));
  const message = String(formData.get("message") ?? "").trim();
  const back = `/promocoes/${id}`;
  if (!message) go(back, "err", "A mensagem não pode ficar vazia.");
  if (message.length > 4000) go(back, "err", "Mensagem muito longa (máx. 4000).");
  const { data: g } = await supabase.from("generations").select("items").eq("id", id).single();
  const items = (g?.items ?? []) as GenItem[];
  if (!items[idx]) go(back, "err", "Item não encontrado.");
  items[idx].message = message;
  const { error } = await supabase.from("generations").update({ items }).eq("id", id);
  if (error) go(back, "err", error.message);
  go(back, "ok", "Mensagem salva.");
}

export async function sendGenItem(formData: FormData) {
  const { supabase, user } = await requireUser();
  const id = String(formData.get("id")); const idx = Number(formData.get("idx"));
  const channelId = String(formData.get("channel_id") ?? "");
  const back = `/promocoes/${id}`;
  if (!channelId) go(back, "err", "Escolha um canal do Telegram.");
  const [{ data: g }, { data: ch }, { data: bot }] = await Promise.all([
    supabase.from("generations").select("items").eq("id", id).single(),
    supabase.from("channels").select("name,type,destination,enabled").eq("id", channelId).maybeSingle(),
    supabase.from("telegram_bot").select("bot_token").maybeSingle(),
  ]);
  const items = (g?.items ?? []) as GenItem[];
  const it = items[idx];
  if (!it) go(back, "err", "Item não encontrado.");
  if (!ch || ch.type !== "telegram" || !ch.enabled || !ch.destination) go(back, "err", "Canal inválido: use um canal do Telegram ativo, com destino preenchido.");
  if (!bot?.bot_token) go(back, "err", "Bot do Telegram não configurado (Canais → Bot do Telegram).");
  const r = await tgSendPost(bot!.bot_token, ch!.destination!, it!.message, it!.image_url);
  if (!r.ok || !r.result?.message_id) go(back, "err", `Telegram recusou: ${friendly(r.ok ? "sem confirmação" : r.error)}`);
  items[idx] = { ...it!, sent_at: new Date().toISOString(), sent_to: ch!.name };
  await supabase.from("generations").update({ items }).eq("id", id);
  await logActivity(supabase, user.id, "promo.sent", { channel: ch!.name, title: it!.title });
  go(back, "ok", `Enviado para ${ch!.name} (confirmado pelo Telegram).`);
}

export async function deleteGeneration(formData: FormData) {
  const { supabase } = await requireUser();
  const id = String(formData.get("id"));
  const { error } = await supabase.from("generations").delete().eq("id", id);
  if (error) go("/promocoes", "err", error.message);
  revalidatePath("/promocoes");
  go("/promocoes", "ok", "Geração excluída.");
}
