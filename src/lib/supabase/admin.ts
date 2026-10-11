import { createClient } from "@supabase/supabase-js";

/** Cliente com poder total (ignora RLS). SÓ no servidor, SÓ no agendador. Nunca importe em componente de navegador. */
export function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
