import { test } from "node:test";
import assert from "node:assert/strict";
import { detectMarketplace, extractExternalId, parseLinks, renderTemplate, DEFAULT_TEMPLATE } from "../src/lib/promo";

test("detecta loja pelo domínio", () => {
  assert.equal(detectMarketplace("https://www.mercadolivre.com.br/p/MLB123"), "mercadolivre");
  assert.equal(detectMarketplace("https://shopee.com.br/x"), "shopee");
  assert.equal(detectMarketplace("https://exemplo.com/x"), null);
});

test("parseLinks: dedupe, inválidas, campos opcionais, limite 30", () => {
  const r = parseLinks("https://a.com/1 | Tênis | 99,90 | 150 | CUPOM1\nhttps://a.com/1\nxxx\nhttps://a.com/2");
  assert.equal(r.items.length, 2);
  assert.equal(r.invalid.length, 1);
  assert.deepEqual([r.items[0].title, r.items[0].price, r.items[0].previous_price, r.items[0].coupon], ["Tênis", 99.9, 150, "CUPOM1"]);
  const many = Array.from({ length: 35 }, (_, i) => `https://a.com/${i}`).join("\n");
  const m = parseLinks(many);
  assert.equal(m.items.length, 30);
  assert.equal(m.extra, 5);
});

test("renderTemplate remove linhas sem dado e não inventa", () => {
  const t = renderTemplate(DEFAULT_TEMPLATE, { link: "https://a.com/1" });
  assert.equal(t, "👉 Compre aqui: https://a.com/1");
  const full = renderTemplate(DEFAULT_TEMPLATE, { title: "Tênis", price: 100, previous_price: 200, coupon: "X", free_shipping: true, link: "https://a.com", slogan: "Corre!" });
  assert.match(full, /Corre!/);
  assert.match(full, /Por R\$\s?100,00 \(de R\$\s?200,00 • -50%\)/);
  assert.match(full, /Cupom: X/);
  assert.match(full, /Frete grátis/);
});

test("extractExternalId", () => {
  assert.equal(extractExternalId("https://x/MLB-1234567890-nome"), "MLB1234567890");
  assert.equal(extractExternalId("https://x/abc"), null);
});
