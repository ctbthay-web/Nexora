/** Converte "1.234,56" ou "12.5" em número. Retorna null se vazio/ inválido. */
export function parseMoney(input: FormDataEntryValue | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  let s = String(input).trim().replace(/[R$\s]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Desconto % calculado só quando o preço anterior é maior que o atual. */
export function calcDiscount(price: number, previous: number | null | undefined): number | null {
  if (previous == null || !(previous > price) || previous <= 0) return null;
  return Math.round(((previous - price) / previous) * 1000) / 10;
}

/** Aceita apenas URLs http(s) bem formadas. */
export function isValidUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Interpreta "2026-10-08T14:30" (datetime-local) no fuso `tz` e devolve o instante UTC. */
export function zonedToUtc(local: string, tz: string): Date {
  const [d, t] = local.split("T");
  const [y, m, da] = d.split("-").map(Number);
  const [h, mi] = t.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, da, h, mi);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
  const p = Object.fromEntries(fmt.formatToParts(new Date(guess)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute);
  return new Date(guess - (asUtc - guess));
}

export const brl = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (iso: string | null | undefined, tz = "America/Sao_Paulo") =>
  iso ? new Date(iso).toLocaleString("pt-BR", { timeZone: tz, dateStyle: "short", timeStyle: "short" }) : "—";
