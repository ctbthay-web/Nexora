"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { brl, parseMoney } from "@/lib/utils";
import { importProducts, type ImportItem } from "./actions";

const ML = /^https:\/\/(www\.)?mercadolivre\.com\.br$/;

export default function ImportList() {
  const [items, setItems] = useState<ImportItem[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [pending, start] = useTransition();
  const got = useRef(false);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (!ML.test(e.origin)) return;
      const d: any = e.data;
      if (!d || d.nexora !== "import" || !Array.isArray(d.items)) return;
      try { (e.source as Window | null)?.postMessage("nexora-ack", e.origin); } catch {}
      if (got.current) return;
      got.current = true;
      const list: ImportItem[] = d.items.slice(0, 60).map((r: any) => ({
        title: String(r?.t ?? "").slice(0, 300),
        price: parseMoney(String(r?.p ?? "")) ?? 0,
        previous_price: parseMoney(String(r?.o ?? "")),
        image: /^https:\/\//.test(String(r?.i ?? "")) ? String(r.i) : null,
        url: String(r?.u ?? ""),
      })).filter((r: ImportItem) => r.title && r.price > 0 && /^https:\/\/([a-z0-9-]+\.)*mercadolivre\.com\.br\//.test(r.url));
      setItems(list);
      setSel(new Set(list.map((_, n) => n)));
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const toggle = (n: number) => setSel((s) => { const x = new Set(s); x.has(n) ? x.delete(n) : x.add(n); return x; });
  function save() {
    setMsg(null);
    start(async () => {
      const r = await importProducts(items.filter((_, n) => sel.has(n)));
      if (r.error) setMsg({ ok: false, t: r.error });
      else setMsg({ ok: true, t: `${r.saved} produto(s) salvos em Produtos${r.skipped ? ` · ${r.skipped} já estavam na lista` : ""}. Abra Editar em cada um para colar o seu link de afiliado.` });
    });
  }

  if (items.length === 0) {
    return <div className="card text-sm text-muted">Nenhuma oferta recebida ainda. Abra a lista de ofertas do Mercado Livre e clique no favorito “Enviar para o Nexora”. Esta tela abre sozinha com os produtos.</div>;
  }
  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm"><b>{items.length}</b> ofertas lidas da página · <b>{sel.size}</b> selecionadas</p>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={() => setSel(sel.size === items.length ? new Set() : new Set(items.map((_, n) => n)))}>{sel.size === items.length ? "Limpar seleção" : "Selecionar todas"}</button>
          <button type="button" className="btn btn-primary" disabled={pending || sel.size === 0} onClick={save}>{pending ? "Salvando…" : "Salvar selecionadas"}</button>
        </div>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-emerald-600" : "text-rose-600"}`}>{msg.t} {msg.ok && <Link href="/produtos" className="underline">Ver Produtos</Link>}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i, n) => (
          <label key={n} className={`card flex cursor-pointer gap-3 ${sel.has(n) ? "ring-2 ring-brand" : ""}`}>
            <input type="checkbox" checked={sel.has(n)} onChange={() => toggle(n)} className="mt-1" />
            {i.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.image} alt="" className="h-20 w-20 shrink-0 rounded-lg border border-line object-contain" />}
            <div className="min-w-0 flex-1 space-y-1">
              <p className="line-clamp-2 text-sm font-semibold">{i.title}</p>
              <p className="text-sm"><b>{brl(i.price)}</b>{i.previous_price && i.previous_price > i.price && <> <span className="text-muted line-through">{brl(i.previous_price)}</span> <span className="badge bg-emerald-500/15 text-emerald-700">-{Math.round((1 - i.price / i.previous_price) * 100)}%</span></>}</p>
            </div>
          </label>
        ))}
      </div>
    </div>
  );
}
