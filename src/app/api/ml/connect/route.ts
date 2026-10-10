import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ML_AUTH, mlEnvOk } from "@/lib/ml";

export const dynamic = "force-dynamic";

function redirectUri(req: NextRequest) {
  return process.env.ML_REDIRECT_URI ?? `${req.nextUrl.origin}/api/ml/callback`;
}

export async function GET(req: NextRequest) {
  const back = (msg: string) => NextResponse.redirect(new URL(`/marketplaces?err=${encodeURIComponent(msg)}`, req.nextUrl.origin));
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  if (!mlEnvOk()) return back("Faltam ML_CLIENT_ID e ML_CLIENT_SECRET nas variáveis da Vercel.");

  const state = crypto.randomUUID();
  const url = new URL(ML_AUTH);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", process.env.ML_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(req));
  url.searchParams.set("state", state);
  const res = NextResponse.redirect(url);
  res.cookies.set("ml_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/api/ml" });
  return res;
}
