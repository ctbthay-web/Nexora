import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { adminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret || secret.length < 24) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? ""); const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** A extensão lê aqui a sua configuração da Automação (termos, horário, limite). Só leitura. */
export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, { status: 500 });
  const { data: profs } = await db.from("profiles").select("id,timezone");
  const prof = process.env.INGEST_USER_ID ? profs?.find((p: any) => p.id === process.env.INGEST_USER_ID) : profs?.length === 1 ? profs[0] : null;
  if (!prof) return NextResponse.json({ error: "defina INGEST_USER_ID (há mais de um usuário)" }, { status: 400 });
  const { data: s } = await db.from("automation_settings").select("search_terms,max_products_per_run,run_time").eq("user_id", prof.id).maybeSingle();
  const lines: string[] = s?.search_terms ?? [];
  return NextResponse.json({
    terms: lines.filter((t) => !/^https?:\/\//i.test(t)),
    max_products_per_run: s?.max_products_per_run ?? 10,
    run_time: s?.run_time ?? "07:00",
    timezone: prof.timezone ?? "America/Sao_Paulo",
  });
}
