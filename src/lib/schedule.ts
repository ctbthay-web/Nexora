import { zonedToUtc } from "./utils";

const pad = (n: number) => String(n).padStart(2, "0");

/** Ano/mês/dia/hora/minuto/dia-da-semana de um instante, no fuso informado. */
export function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", weekday: "short",
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, weekday: wd, key: `${p.year}-${p.month}-${p.day}` };
}

export const isTime = (s: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(s);

/**
 * Próximos horários de publicação livres, depois de `now`.
 * `taken` = instantes já ocupados na fila (para respeitar o limite diário e não repetir horário).
 */
export function upcomingSlots(opts: {
  now: Date; tz: string; times: string[]; weekdays: number[]; perDay: number; count: number; taken: Date[]; maxDays?: number;
}): Date[] {
  const { now, tz, weekdays, perDay, count } = opts;
  const times = [...new Set(opts.times.filter(isTime))].sort();
  if (!times.length || !weekdays.length || count <= 0) return [];
  const perDayCount = new Map<string, number>();
  const takenMin = new Set<number>();
  for (const t of opts.taken) {
    const k = localParts(t, tz).key;
    perDayCount.set(k, (perDayCount.get(k) ?? 0) + 1);
    takenMin.add(Math.floor(t.getTime() / 60000));
  }
  const out: Date[] = [];
  const start = localParts(now, tz);
  for (let i = 0; i < (opts.maxDays ?? 60) && out.length < count; i++) {
    const base = new Date(Date.UTC(start.y, start.m - 1, start.d + i, 12));
    const day = `${base.getUTCFullYear()}-${pad(base.getUTCMonth() + 1)}-${pad(base.getUTCDate())}`;
    if (!weekdays.includes(base.getUTCDay())) continue;
    for (const t of times) {
      if (out.length >= count) break;
      if ((perDayCount.get(day) ?? 0) >= perDay) break;
      const at = zonedToUtc(`${day}T${t}`, tz);
      if (at.getTime() <= now.getTime() + 60_000) continue;
      if (takenMin.has(Math.floor(at.getTime() / 60000))) continue;
      out.push(at);
      perDayCount.set(day, (perDayCount.get(day) ?? 0) + 1);
      takenMin.add(Math.floor(at.getTime() / 60000));
    }
  }
  return out;
}

/** A rotina diária (coleta + IA) já deveria ter rodado hoje e ainda não rodou? */
export function dailyRunDue(opts: { now: Date; tz: string; runTime: string; weekdays: number[]; lastRunAt: Date | null }): boolean {
  const n = localParts(opts.now, opts.tz);
  if (!opts.weekdays.includes(n.weekday) || !isTime(opts.runTime)) return false;
  const scheduled = zonedToUtc(`${n.key}T${opts.runTime}`, opts.tz);
  if (opts.now.getTime() < scheduled.getTime()) return false;
  return !opts.lastRunAt || opts.lastRunAt.getTime() < scheduled.getTime();
}
