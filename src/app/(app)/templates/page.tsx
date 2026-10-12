import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { DEFAULT_TEMPLATE, PLACEHOLDERS } from "@/lib/promo";
import { addSlogan, addTemplate, deleteSlogan, deleteTemplate, setDefaultTemplate } from "./actions";

export default async function TemplatesPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase } = await requireUser();
  const [{ data: tpls }, { data: slogans }] = await Promise.all([
    supabase.from("message_templates").select("id,name,body,is_default").order("created_at"),
    supabase.from("slogans").select("id,text").order("created_at"),
  ]);
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Templates e slogans</h1>
      <Flash searchParams={searchParams} />

      <section className="card space-y-3">
        <h2 className="font-semibold">Novo modelo de mensagem</h2>
        <form action={addTemplate} className="space-y-2">
          <div><label className="label">Nome</label><input name="name" required className="input" placeholder="Ex.: Oferta com cupom" /></div>
          <div><label className="label">Texto (use os campos abaixo)</label><textarea name="body" required rows={8} defaultValue={DEFAULT_TEMPLATE} className="input font-mono text-xs" /></div>
          <SubmitButton>Salvar modelo</SubmitButton>
        </form>
        <ul className="grid gap-x-4 gap-y-1 text-xs text-muted md:grid-cols-2">
          {PLACEHOLDERS.map(([k, d]) => <li key={k}><code>{k}</code> — {d}</li>)}
        </ul>
        <p className="text-xs text-muted">Se um campo de uma linha estiver vazio, a linha inteira some da mensagem. Assim nada é inventado.</p>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">Seus modelos</h2>
        {(tpls ?? []).length === 0 && <div className="card text-sm text-muted">Nenhum modelo seu ainda. Enquanto isso, vale o modelo padrão do Nexora.</div>}
        {(tpls ?? []).map((t: any) => (
          <div key={t.id} className="card space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <b>{t.name}{t.is_default && <span className="badge ml-2 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">padrão</span>}</b>
              <div className="flex gap-2">
                {!t.is_default && <form action={setDefaultTemplate}><input type="hidden" name="id" value={t.id} /><SubmitButton className="btn">Tornar padrão</SubmitButton></form>}
                <form action={deleteTemplate}><input type="hidden" name="id" value={t.id} /><SubmitButton className="btn" confirm="Excluir este modelo?">Excluir</SubmitButton></form>
              </div>
            </div>
            <pre className="whitespace-pre-wrap rounded-lg bg-bg p-2 text-xs">{t.body}</pre>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Slogans</h2>
        <form action={addSlogan} className="flex gap-2">
          <input name="text" required maxLength={120} className="input" placeholder="Ex.: Achadinho imperdível!" />
          <SubmitButton>Adicionar</SubmitButton>
        </form>
        <ul className="space-y-1">
          {(slogans ?? []).length === 0 && <li className="text-sm text-muted">Nenhum slogan cadastrado.</li>}
          {(slogans ?? []).map((s: any) => (
            <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
              <span>{s.text}</span>
              <form action={deleteSlogan}><input type="hidden" name="id" value={s.id} /><SubmitButton className="btn">Remover</SubmitButton></form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
