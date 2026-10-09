export default function SetupPage() {
  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-2 text-2xl font-bold text-brand">Falta configurar o Supabase</h1>
      <p className="mb-4 text-sm text-muted">As variáveis de ambiente ainda não foram preenchidas.</p>
      <ol className="card list-decimal space-y-2 pl-8 text-sm">
        <li>Crie um projeto gratuito em supabase.com.</li>
        <li>No <b>SQL Editor</b>, cole e execute o arquivo <code>supabase/migrations/0001_init.sql</code>.</li>
        <li>Em <b>Project Settings → API</b>, copie a <b>Project URL</b> e a chave <b>anon public</b>.</li>
        <li>Copie <code>.env.example</code> para <code>.env.local</code> e preencha as duas variáveis.</li>
        <li>Pare e reinicie o <code>npm run dev</code>.</li>
      </ol>
    </main>
  );
}
