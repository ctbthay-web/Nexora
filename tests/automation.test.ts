import test from "node:test";
import assert from "node:assert/strict";
import { upcomingSlots, dailyRunDue, localParts } from "../src/lib/schedule";
import { sanitizeAi } from "../src/lib/gemini";
import { finalCaption } from "../src/lib/gemini";

const TZ = "America/Sao_Paulo";

test("upcomingSlots usa os horários futuros do dia e respeita o limite diário", () => {
  const now = new Date("2026-10-10T12:00:00Z"); // 09:00 em São Paulo
  const s = upcomingSlots({ now, tz: TZ, times: ["09:00", "13:00", "19:00"], weekdays: [0,1,2,3,4,5,6], perDay: 2, count: 4, taken: [] });
  const hours = s.map((d) => { const p = localParts(d, TZ); return `${p.key} ${String(p.h).padStart(2,"0")}:${String(p.mi).padStart(2,"0")}`; });
  assert.deepEqual(hours, ["2026-10-10 13:00", "2026-10-10 19:00", "2026-10-11 09:00", "2026-10-11 13:00"]);
});

test("upcomingSlots não repete horário ocupado e pula dias não permitidos", () => {
  const now = new Date("2026-10-10T12:00:00Z"); // sábado
  const taken = [new Date("2026-10-10T16:00:00Z")]; // 13:00 local ocupado
  const s = upcomingSlots({ now, tz: TZ, times: ["13:00", "19:00"], weekdays: [1], perDay: 5, count: 2, taken });
  assert.equal(localParts(s[0], TZ).weekday, 1);
  assert.equal(s.length, 2);
});

test("dailyRunDue roda uma vez por dia depois do horário", () => {
  const base = { tz: TZ, runTime: "07:00", weekdays: [0,1,2,3,4,5,6] };
  assert.equal(dailyRunDue({ ...base, now: new Date("2026-10-10T09:30:00Z"), lastRunAt: null }), false); // 06:30
  assert.equal(dailyRunDue({ ...base, now: new Date("2026-10-10T10:30:00Z"), lastRunAt: null }), true);  // 07:30
  assert.equal(dailyRunDue({ ...base, now: new Date("2026-10-10T10:30:00Z"), lastRunAt: new Date("2026-10-10T10:05:00Z") }), false);
  assert.equal(dailyRunDue({ ...base, now: new Date("2026-10-11T10:30:00Z"), lastRunAt: new Date("2026-10-10T10:05:00Z") }), true);
});

test("sanitizeAi remove link, preço e porcentagem inventados e limita a nota", () => {
  const r = sanitizeAi({ score: 14, notes: "ok", caption: "Super oferta por R$ 9,90 com 50% off! https://x.com/a", issues: ["sem imagem"] });
  assert.equal(r.score, 10);
  assert.ok(!/R\$|%|http/.test(r.caption));
  assert.throws(() => sanitizeAi({ score: "abc" }));
});

test("finalCaption monta preço e link pelo código, não pela IA", () => {
  const c = finalCaption({ body: "Ótimo para o dia a dia", price: 59.9, previous_price: 99.9, coupon: null, free_shipping: true, shipping_info: null, shipping_coupon: null, affiliate_url: "https://meli.la/abc" });
  assert.match(c, /Por R\$\s*59,90/);
  assert.match(c, /-40%/);
  assert.match(c, /Frete grátis/);
  assert.match(c, /https:\/\/meli\.la\/abc$/);
});
