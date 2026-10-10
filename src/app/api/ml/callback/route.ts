import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCode, mlEnvOk } from "@/lib/ml";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const done = (kind: "ok" | "err", msg: string) => {
    const res = NextResponse.redirect(new URL(`/marketplaces?${kind}=${encodeURIComponent(msg)}`, origin));
    res.cookies.delete({ name: "ml_state", path: "/api/ml" });
    return res;
  };
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (!mlEnvOk()) return done("err", "Faltam ML_CLIENT_ID e ML_CLIENT_SECRET nas variáveis da Vercel.");

  const p = req.nextUrl.searchParams;
  if (p.get("error")) return done("err", `Mercado Livre: ${p.get("error_description") ?? p.get("error")}`);
  const code = p.get("code");
  const expected = req.cookies.get("ml_state")?.value;
  if (!code || !expected || p.get("state") !== expected) return done("err", "Autorização inválida ou expirada. Tente conectar de novo.");

  try {
    const redirect = process.env.ML_REDIRECT_URI ?? `${origin}/api/ml/callback`;
    const t = await exchangeCode(code, redirect);
    const { error } = await supabase.from("ml_tokens").upsert({
      user_id: user.id, access_token: t.access_token, refresh_token: t.refresh_token,
      expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
      ml_user_id: t.user_id ?? null, updated_at: new Date().toISOString(),
    });
    if (error) return done("err", `Não consegui salvar a conexão: ${error.message} (rodou o SQL 0003?)`);
    await supabase.from("marketplace_connections").update({ status: "configured", last_error: null }).eq("marketplace", "mercadolivre");
    await supabase.from("activity_log").insert({ user_id: user.id, action: "ml.connected", details: { title: "Mercado Livre" } });
    return done("ok", "Mercado Livre conectado.");
  } catch (e: any) {
    return done("err", e?.message ?? "Falha ao conectar.");
  }
}
