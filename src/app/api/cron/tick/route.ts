import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { adminClient } from "@/lib/supabase/admin";
import { dailyRunDue } from "@/lib/schedule";
import { ensureSettings, runPipeline } from "@/lib/automation";
import { publishDue } from "@/lib/publisher";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const a = Buffer.from(got); const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Chamado a cada 5 min pelo agendador do Supabase (pg_cron). Só roda com o segredo correto. */
async function tick(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  const db = adminClient();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY não configurada" }, { status: 500 });
  const t0 = Date.now();
  const { data: all } = await db.from("profiles").select("id,timezone,automation_status");
  for (const u of all ?? []) await ensureSettings(db, u.id).then(() => db.from("automation_settings").update({ last_tick_at: new Date().toISOString() }).eq("user_id", u.id));
  const users = (all ?? []).filter((u: any) => u.automation_status === "running");
  const report: any[] = [];
  for (const u of users ?? []) {
    if (Date.now() - t0 > 45_000) { report.push({ user: u.id, skipped: "tempo esgotado, fica para o próximo ciclo" }); continue; }
    try {
      const s = await ensureSettings(db, u.id);
      const due = dailyRunDue({ now: new Date(), tz: u.timezone ?? "America/Sao_Paulo", runTime: s.run_time, weekdays: s.weekdays, lastRunAt: s.last_run_at ? new Date(s.last_run_at) : null });
      if (due) { const r = await runPipeline(db, u.id, "daily"); report.push({ user: u.id, daily: r.status }); }
      else { const r = await publishDue(db, { userId: u.id, respectPause: true }); if (r.sent || r.failed || r.retry) report.push({ user: u.id, publish: r }); }
    } catch (e: any) { report.push({ user: u.id, error: e?.message ?? "erro" }); }
  }
  return NextResponse.json({ ok: true, users: users?.length ?? 0, report });
}
export const GET = tick;
export const POST = tick;
