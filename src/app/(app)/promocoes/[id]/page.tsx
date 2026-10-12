import Link from "next/link";
import { notFound } from "next/navigation";
import Flash from "@/components/Flash";
import CopyButton from "@/components/CopyButton";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { fmtDate } from "@/lib/utils";
import { saveGenMessage, sendGenItem } from "../actions";
import type { GenItem } from "../actions";

export default async function GenerationPage({ params, searchParams }: { params: { id: string }; searchParams: { ok?: string; err?: string } }) {
  const { supabase } = await requireUser();
  const [{ data: g }, { data: chans }] = await Promise.all([
    supabase.from("generations").select("id,template_name,items,created_at").eq("id", params.id).maybeSingle(),
    supabase.from("channels").select("id,name,destination,status").eq("type", "telegram").eq("enabled", true).order("created_at"),
  ]);
  if (!g) notFound();
  const items = (g.items ?? []) as GenItem[];
  const all = items.map((i) => i.message).join("\n\n――――――――\n\n");
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link href="/promocoes" className="text-xs text-muted underline">← Gerar promoção</Link>
          <h1 className="text-2xl font-bold">{items.length} mensagem(ns)</h1>
          <p className="text-xs text-muted">{fmtDate(g.created_at)} • {g.template_name}</p>
        </div>
        <CopyButton text={all} label="Copiar todas" />
      </div>
      <Flash searchParams={searchParams} />
      {(chans ?? []).length === 0 && (
        <div className="card text-sm">Para enviar direto ao Telegram, cadastre um canal do Telegram em <Link href="/canais" className="underline">Canais</Link>. Copiar já funciona.</div>
      )}
      {items.map((it, idx) => (
        <div key={idx} className="card space-y-2">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="badge bg-slate-500/15 text-muted">{it.marketplace ?? "loja não reconhecida"}</span>
            {it.from_product && <span className="badge bg-indigo-500/15 text-indigo-700 dark:text-indigo-300">dados de Produtos</span>}
            {!it.affiliate_ok && <span className="badge bg-amber-500/15 text-amber-700 dark:text-amber-300">link sem afiliado confirmado</span>}
            {it.sent_at && <span className="badge bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">enviado para {it.sent_to} • {fmtDate(it.sent_at)}</span>}
          </div>
          <form action={saveGenMessage} className="space-y-2">
            <input type="hidden" name="id" value={g.id} /><input type="hidden" name="idx" value={idx} />
            <textarea name="message" defaultValue={it.message} rows={Math.min(12, it.message.split("\n").length + 1)} className="input" />
            <div className="flex flex-wrap gap-2"><SubmitButton className="btn">Salvar edição</SubmitButton><CopyButton text={it.message} label="Copiar" /></div>
          </form>
          {(chans ?? []).length > 0 && (
            <form action={sendGenItem} className="flex flex-wrap items-center gap-2">
              <input type="hidden" name="id" value={g.id} /><input type="hidden" name="idx" value={idx} />
              <select name="channel_id" className="input max-w-xs" defaultValue={chans![0].id}>
                {chans!.map((c: any) => <option key={c.id} value={c.id}>{c.name} {c.destination ?? ""}</option>)}
              </select>
              <SubmitButton className="btn btn-primary" confirm={it.affiliate_ok ? undefined : "Este link não está marcado como seu link de afiliado. Enviar mesmo assim?"}>
                {it.sent_at ? "Enviar de novo" : "Enviar ao Telegram"}
              </SubmitButton>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}
