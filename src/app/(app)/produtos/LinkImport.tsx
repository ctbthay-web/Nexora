"use client";
import { useState } from "react";
import { buildCaption } from "@/lib/caption";

/** Cola o link do produto do Mercado Livre e preenche o cadastro com os dados reais. */
export default function LinkImport() {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  async function run() {
    setBusy(true); setMsg(null);
    try {
      const res = await fetch("/api/ml/item", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, t: j.error ?? "Não consegui buscar esse link." }); return; }
      const f = (document.getElementById("title") as HTMLInputElement | null)?.form;
      if (!f) return;
      const set = (n: string, v: string) => { const e = f.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null; if (e) e.value = v; };
      set("title", j.title); set("marketplace", "mercadolivre");
      set("price", String(j.price).replace(".", ","));
      set("previous_price", j.original_price ? String(j.original_price).replace(".", ",") : "");
      set("image_url", j.image ?? ""); set("original_url", j.permalink ?? url);
      if (j.category) set("category", j.category);
      const fs = f.elements.namedItem("free_shipping") as HTMLInputElement | null; if (fs) fs.checked = j.free_shipping === true;
      const aff = (f.elements.namedItem("affiliate_url") as HTMLInputElement | null)?.value.trim() || null;
      const ta = f.elements.namedItem("promo_text") as HTMLTextAreaElement | null;
      if (ta) ta.value = buildCaption({ title: j.title, price: j.price, previous_price: j.original_price, coupon: null, free_shipping: j.free_shipping === true, shipping_info: null, shipping_coupon: null, affiliate_url: aff });
      setMsg({ ok: true, t: `Dados preenchidos${j.source === "pagina" ? " (lidos da página do anúncio)" : ""}. Confira, cole o seu link de afiliado e cadastre.${j.free_shipping ? "" : " Frete e cupom não vêm do anúncio: preencha se houver."}` });
    } catch { setMsg({ ok: false, t: "Falha de conexão. Tente de novo." }); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-2 rounded-lg border border-line bg-bg p-3 md:col-span-2">
      <label className="label" htmlFor="ml_link">Cole o link do produto do Mercado Livre e preencha sozinho</label>
      <div className="flex gap-2">
        <input id="ml_link" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.mercadolivre.com.br/..." className="input" />
        <button type="button" className="btn btn-primary shrink-0" disabled={busy || !url.trim()} onClick={run}>{busy ? "Buscando…" : "Preencher"}</button>
      </div>
      {msg && <p className={`text-xs ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.t}</p>}
    </div>
  );
}
