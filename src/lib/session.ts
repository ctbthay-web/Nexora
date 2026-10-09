import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function logActivity(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  action: string,
  details: Record<string, unknown> = {}
) {
  await supabase.from("activity_log").insert({ user_id: userId, action, details });
}

/** Redireciona com mensagem de sucesso (ok) ou erro (err) exibida pelo componente Flash. */
export function go(path: string, kind: "ok" | "err", msg: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(msg)}`);
}
