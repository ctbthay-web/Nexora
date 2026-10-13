import { test } from "node:test";
import assert from "node:assert/strict";
import { validateIngest } from "../src/lib/ingest";

test("ingest: aceita dados completos e rejeita o resto sem inventar", () => {
  const r = validateIngest({ products: [
    { url: "https://www.mercadolivre.com.br/p/MLB1234567890", title: "Tênis", price: "99,90", previous_price: 150 },
    { url: "https://exemplo.com/x", title: "Fora", price: 10 },
    { url: "https://www.mercadolivre.com.br/p/MLB1", title: "", price: 10 },
    { url: "https://www.mercadolivre.com.br/p/MLB2", title: "Sem preço" },
    { url: "https://shopee.com.br/x-i.1.2", title: "Capa", price: 20, previous_price: 10 },
  ] });
  assert.equal(r.rows.length, 2);
  assert.equal(r.rejected.length, 3);
  assert.equal(r.rows[0].price, 99.9);
  assert.equal(r.rows[0].previous_price, 150);
  assert.equal(r.rows[0].external_id, "MLB1234567890");
  assert.equal(r.rows[1].previous_price, null);
  assert.match(r.rows[1].external_id, /^url-/);
});
test("ingest: limite de 50", () => {
  const products = Array.from({ length: 80 }, (_, i) => ({ url: `https://shopee.com.br/p-${i}`, title: "x", price: 5 }));
  assert.equal(validateIngest({ products }).rows.length, 50);
});
