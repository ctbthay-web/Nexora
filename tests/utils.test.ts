import test from "node:test";
import assert from "node:assert/strict";
import { calcDiscount, isValidUrl, parseMoney, zonedToUtc } from "../src/lib/utils";

test("parseMoney entende formato brasileiro e inválidos", () => {
  assert.equal(parseMoney("1.234,56"), 1234.56);
  assert.equal(parseMoney("R$ 59,90"), 59.9);
  assert.equal(parseMoney("12.5"), 12.5);
  assert.equal(parseMoney(""), null);
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney("-3"), null);
});

test("calcDiscount só calcula com preço anterior maior", () => {
  assert.equal(calcDiscount(59.9, 99.9), 40);
  assert.equal(calcDiscount(100, 100), null);
  assert.equal(calcDiscount(100, 50), null);
  assert.equal(calcDiscount(100, null), null);
});

test("isValidUrl aceita só http(s)", () => {
  assert.equal(isValidUrl("https://shopee.com.br/x"), true);
  assert.equal(isValidUrl("javascript:alert(1)"), false);
  assert.equal(isValidUrl("não é url"), false);
  assert.equal(isValidUrl(null), false);
});

test("zonedToUtc converte fuso de São Paulo (UTC-3) e UTC", () => {
  assert.equal(zonedToUtc("2026-10-08T14:30", "America/Sao_Paulo").toISOString(), "2026-10-08T17:30:00.000Z");
  assert.equal(zonedToUtc("2026-10-08T14:30", "UTC").toISOString(), "2026-10-08T14:30:00.000Z");
});
