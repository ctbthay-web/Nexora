"use client";
import { useRef, useState } from "react";
import { buildCaption } from "@/lib/caption";
import { parseMoney } from "@/lib/utils";

/** Campo de legenda com botão "Gerar a partir dos dados" (lê os campos reais do formulário). */
export default function CaptionField({ defaultValue }: { defaultValue?: string | null }) {
  const ta = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  function generate() {
    const f = ta.current?.form;
    if (!f) return;
    const v = (n: string) => (f.elements.namedItem(n) as HTMLInputElement | null);
    const text = (n: string) => v(n)?.value.trim() || null;
    ta.current!.value = buildCaption({
      title: text("title"), price: parseMoney(text("price")), previous_price: parseMoney(text("previous_price")),
      coupon: text("coupon"), free_shipping: v("free_shipping")?.checked ?? false,
      shipping_info: text("shipping_info"), shipping_coupon: text("shipping_coupon"), affiliate_url: text("affiliate_url"),
    });
  }
  async function copy() {
    try { await navigator.clipboard.writeText(ta.current?.value ?? ""); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  }
  return (
    <div>
      <label className="label" htmlFor="promo_text">Legenda do post (copy)</label>
      <textarea ref={ta} id="promo_text" name="promo_text" rows={7} defaultValue={defaultValue ?? ""} className="input" />
      <div className="mt-2 flex gap-2">
        <button type="button" className="btn" onClick={generate}>Gerar a partir dos dados</button>
        <button type="button" className="btn" onClick={copy}>{copied ? "Copiado!" : "Copiar legenda"}</button>
      </div>
      <p className="mt-1 text-xs text-muted">A legenda usa só o que você preencheu acima. Você pode editar à vontade.</p>
    </div>
  );
}
