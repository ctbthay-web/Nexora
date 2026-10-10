import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { TIMEZONES } from "@/lib/constants";
import { saveSettings } from "./actions";

export default async function SettingsPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  const { supabase, user } = await requireUser();
  const { data: p } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  const tz = p?.timezone ?? "America/Sao_Paulo";
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-bold">Configurações</h1>
      <Flash searchParams={searchParams} />
      <form action={saveSettings} className="card grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2"><label className="label">E-mail da conta</label><input disabled value={user.email ?? ""} className="input" /></div>
        <div><label className="label">Nome de exibição</label><input name="display_name" defaultValue={p?.display_name ?? ""} className="input" /></div>
        <div>
          <label className="label">Fuso horário</label>
          <select name="timezone" defaultValue={tz} className="input">{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div><label className="label">Cor da marca (aplicada no app)</label><input type="color" name="brand_color" defaultValue={p?.brand_color ?? "#6d5efc"} className="h-10 w-16 cursor-pointer rounded-lg border border-line bg-bg p-1" /></div>
        <div className="flex items-end"><SubmitButton>Salvar</SubmitButton></div>
      </form>
      <section className="card">
        <h2 className="mb-1 text-sm font-semibold">Provedores de IA, logotipo, regras de automação, limites</h2>
        <p className="text-sm text-muted">Chegam nas Fases 2 e 3, junto com as funções que dependem deles.</p>
      </section>
    </div>
  );
}
