import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { adminClient } from "@/lib/supabase/admin";
import { validateIngest } from "@/lib/ingest";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest) {
  const secret = process.env.INGEST_SECRET;
  if (!secret || secret.length < 24) return false;
  const a = Buffer.from(req.headers.get("authorization") ?? ""); const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Recebe produtos de uma automação externa (n8n). Entram em Produtos como "encontrado", SEM link de afiliado
 * (affiliate_verified=false): o link continua precisando ser confirmado por você antes de publicar.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, { status: 500 });
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "JSON inválido" }, { status: 400 }); }

  const { data: profs, error: pe } = await db.from("profiles").select("id");
  if (pe) return NextResponse.json({ error: "leitura de perfis falhou" }, { status: 500 });
  const userId = process.env.INGEST_USER_ID || (profs?.length === 1 ? profs[0].id : null);
  if (!userId) return NextResponse.json({ error: "defina INGEST_USER_ID (há mais de um usuário)" }, { status: 400 });

  const { rows, rejected } = validateIngest(body);
  let inserted = 0;
  if (rows.length) {
    const { data, error } = await db.from("products").upsert(
      rows.map((r) => ({ ...r, user_id: userId, source: "api", is_demo: false, status: "found", affiliate_verified: !!r.affiliate_url })),
      { onConflict: "user_id,marketplace,external_id", ignoreDuplicates: true },
    ).select("id");
    if (error) return NextResponse.json({ error: "não foi possível salvar", detail: error.message }, { status: 500 });
    inserted = data?.length ?? 0;
  }
  // produto que já existia sem link: completa com o link de afiliado gerado na sua conta (nunca troca um link já salvo)
  for (const r of rows) {
    if (r.affiliate_url) await db.from("products").update({ affiliate_url: r.affiliate_url, affiliate_verified: true }).eq("user_id", userId).eq("marketplace", r.marketplace).eq("external_id", r.external_id).is("affiliate_url", null);
  }
  await db.from("activity_log").insert({ user_id: userId, action: "ingest.received", details: { title: "n8n", received: rows.length + rejected.length, inserted, rejected: rejected.length } });
  return NextResponse.json({ ok: true, received: rows.length + rejected.length, inserted, duplicates: rows.length - inserted, rejected });
}
