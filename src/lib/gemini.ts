import { brl } from "./utils";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const geminiConfigured = () => !!process.env.GEMINI_API_KEY;

export type AiProduct = {
  title: string; marketplace: string; price: number; previous_price: number | null; coupon: string | null;
  free_shipping: boolean | null; shipping_info: string | null; category: string | null; rating: number | null; has_image: boolean; has_affiliate_link: boolean;
};
export type AiResult = { score: number; notes: string; caption: string; issues: string[] };

const SYSTEM = [
  "Você avalia ofertas de e-commerce brasileiro para um canal de achadinhos e escreve legendas curtas em português do Brasil.",
  "REGRAS ABSOLUTAS: use SOMENTE os dados fornecidos. NUNCA invente preço, desconto, avaliação, estoque, comissão, cupom, frete, prazo ou urgência.",
  "Não escreva links nem a palavra 'link'. Não escreva valores em reais nem porcentagens na legenda: o sistema acrescenta preço e link depois.",
  "A nota (0 a 10) mede a qualidade da oferta SÓ com os dados dados: desconto real, completude (imagem, categoria, link de afiliado) e coerência.",
  "Liste em 'issues' o que está ausente ou inconsistente (ex.: sem imagem, sem preço anterior, título confuso).",
].join(" ");

/** Pede ao Gemini nota + legenda. Lança erro com mensagem clara em falhas. */
export async function geminiEvaluate(p: AiProduct): Promise<AiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY não configurada no servidor (Vercel → Settings → Environment Variables).");
  const facts = {
    titulo: p.title, loja: p.marketplace, preco: p.price, preco_anterior: p.previous_price, cupom: p.coupon,
    frete_gratis: p.free_shipping, info_frete: p.shipping_info, categoria: p.category, avaliacao: p.rating,
    tem_imagem: p.has_image, tem_link_de_afiliado: p.has_affiliate_link,
  };
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts: [{ text: `Dados do produto (JSON):\n${JSON.stringify(facts)}\n\nDevolva a nota, observações, a legenda (2 a 4 linhas, com emojis moderados, sem preço e sem link) e a lista de problemas.` }] }],
    generationConfig: {
      temperature: 0.4, maxOutputTokens: 700, responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          score: { type: "INTEGER" }, notes: { type: "STRING" }, caption: { type: "STRING" },
          issues: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["score", "notes", "caption", "issues"],
      },
    },
  };
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(40_000),
  });
  const j: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = j?.error?.message ?? `HTTP ${res.status}`;
    if (res.status === 400 && /api key/i.test(msg)) throw new Error("Chave do Gemini inválida.");
    if (res.status === 429) throw new Error("Limite de uso do Gemini atingido. Tente mais tarde.");
    throw new Error(`Gemini respondeu ${res.status}: ${msg}`);
  }
  const text = j?.candidates?.[0]?.content?.parts?.map((x: any) => x.text ?? "").join("") ?? "";
  let o: any;
  try { o = JSON.parse(text); } catch { throw new Error("O Gemini devolveu uma resposta fora do formato esperado."); }
  return sanitizeAi(o);
}

/** Garante nota 0–10 e remove da legenda qualquer valor/porcentagem/link que a IA possa ter inventado. */
export function sanitizeAi(o: any): AiResult {
  const score = Math.max(0, Math.min(10, Math.round(Number(o?.score))));
  if (!Number.isFinite(score)) throw new Error("Nota inválida devolvida pela IA.");
  let caption = String(o?.caption ?? "").replace(/https?:\/\/\S+/gi, "").replace(/R\$\s*[\d.,]+/gi, "").replace(/\b\d+(?:[.,]\d+)?\s*%/g, "");
  caption = caption.split("\n").map((l) => l.replace(/[ \t]+/g, " ").trimEnd()).join("\n").replace(/\n{3,}/g, "\n\n").trim();
  const issues = Array.isArray(o?.issues) ? o.issues.map((x: unknown) => String(x).slice(0, 160)).slice(0, 8) : [];
  return { score, notes: String(o?.notes ?? "").slice(0, 400), caption: caption.slice(0, 600), issues };
}

/** Legenda final: texto da IA (ou do usuário) + linhas de preço/cupom/frete montadas pelo código + link confirmado. */
export function finalCaption(p: { body: string | null; price: number; previous_price: number | null; coupon: string | null; free_shipping: boolean | null; shipping_info: string | null; shipping_coupon: string | null; affiliate_url: string }): string {
  const lines: string[] = [];
  if (p.body?.trim()) lines.push(p.body.trim(), "");
  let l = `💰 Por ${brl(p.price)}`;
  if (p.previous_price && p.previous_price > p.price) l += ` (de ${brl(p.previous_price)} • -${Math.round(((p.previous_price - p.price) / p.previous_price) * 100)}%)`;
  lines.push(l);
  if (p.coupon) lines.push(`🎟️ Cupom: ${p.coupon}`);
  if (p.free_shipping) lines.push("🚚 Frete grátis");
  if (p.shipping_info) lines.push(`🚚 ${p.shipping_info}`);
  if (p.shipping_coupon) lines.push(`🎫 Cupom de frete: ${p.shipping_coupon}`);
  lines.push("", `👉 Compre aqui: ${p.affiliate_url}`);
  return lines.join("\n");
}

/** Legenda que vai para a fila: se o texto do produto já contém o link, usa como está; senão monta com preço e link. */
export function queueCaption(p: { promo_text: string | null; price: number | string; previous_price: number | string | null; coupon: string | null; free_shipping: boolean | null; shipping_info: string | null; shipping_coupon: string | null; affiliate_url: string }): string {
  if (p.promo_text && p.promo_text.includes(p.affiliate_url)) return p.promo_text;
  return finalCaption({
    body: p.promo_text, price: Number(p.price), previous_price: p.previous_price != null ? Number(p.previous_price) : null,
    coupon: p.coupon, free_shipping: p.free_shipping, shipping_info: p.shipping_info, shipping_coupon: p.shipping_coupon, affiliate_url: p.affiliate_url,
  });
}
