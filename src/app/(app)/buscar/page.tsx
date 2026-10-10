import Link from "next/link";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { brl } from "@/lib/utils";
import { ML_NEEDS_APP, getMlApp, getMlToken, searchMl, type MlItem } from "@/lib/ml";
import { saveFromMl } from "./actions";

export default async function Buscar({ searchParams }: { searchParams: { q?: string; ok?: string; err?: string } }) {
  const { supabase, user } = await requireUser();
  const q = (searchParams.q ?? "").trim();

  let notice: string | null = null;
  let items: MlItem[] = [];
  const hasApp = !!(await getMlApp(supabase, user.id));
  const token = hasApp ? await getMlToken(supabase, user.id).catch(() => null) : null;
  if (!hasApp) notice = ML_NEEDS_APP;
  else if (!token) notice = "Mercado Livre ainda não conectado. Vá em Marketplaces e clique em Conectar.";
  else if (q) {
    const r = await searchMl(token, q);
    if ("error" in r) notice = r.error; else items = r.items;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Buscar no Mercado Livre</h1>
      <Flash searchParams={searchParams} />
      <form method="get" className="card flex gap-2">
        <input name="q" defaultValue={q} placeholder="Ex.: fone bluetooth, panela, tênis…" className="input" />
        <button className="btn btn-primary">Buscar</button>
      </form>
      {notice && <div className="card text-sm text-amber-600">{notice} {!token && <Link href="/marketplaces" className="underline">Ir para Marketplaces</Link>}</div>}
      {q && !notice && items.length === 0 && <div className="card text-sm text-muted">Nenhum resultado.</div>}
      <p className="text-xs text-muted">Preços, imagens e frete vêm direto do Mercado Livre no momento da busca. O link de afiliado não é gerado aqui: salve o produto e cole o link do seu programa.</p>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((i) => (
          <article key={i.id} className="card flex gap-3">
            {i.image && /* eslint-disable-next-line @next/next/no-img-element */ <img src={i.image} alt="" className="h-24 w-24 shrink-0 rounded-lg border border-line object-contain" />}
            <div className="min-w-0 flex-1 space-y-1">
              <h2 className="line-clamp-2 text-sm font-semibold">{i.title}</h2>
              <div className="flex items-baseline gap-2">
                <span className="font-bold">{brl(i.price)}</span>
                {i.original_price && <span className="text-xs text-muted line-through">{brl(i.original_price)}</span>}
                {i.free_shipping && <span className="text-xs">Frete grátis</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a href={i.permalink} target="_blank" rel="noreferrer" className="btn">Ver no site</a>
                <form action={saveFromMl}>
                  <input type="hidden" name="q" value={q} />
                  <input type="hidden" name="id" value={i.id} />
                  <input type="hidden" name="title" value={i.title} />
                  <input type="hidden" name="price" value={i.price} />
                  <input type="hidden" name="original_price" value={i.original_price ?? ""} />
                  <input type="hidden" name="permalink" value={i.permalink} />
                  <input type="hidden" name="image" value={i.image ?? ""} />
                  <input type="hidden" name="free_shipping" value={i.free_shipping ? "1" : "0"} />
                  <SubmitButton>Salvar em Produtos</SubmitButton>
                </form>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
