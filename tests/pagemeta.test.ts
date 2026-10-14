import { test } from "node:test";
import assert from "node:assert/strict";
import { extractMeta } from "../src/lib/pagemeta";

test("pagemeta: lê JSON-LD de produto", () => {
  const html = `<html><script type="application/ld+json">{"@type":"Product","name":"Fone &amp; Cia","image":"https://http2.mlstatic.com/a.jpg","offers":{"price":"129.9"}}</script></html>`;
  const m = extractMeta(html);
  assert.equal(m.title, "Fone & Cia");
  assert.equal(m.price, 129.9);
  assert.equal(m.image, "https://http2.mlstatic.com/a.jpg");
});

test("pagemeta: usa metatags e não inventa o que falta", () => {
  const m = extractMeta(`<meta property="og:title" content="Capa"><meta property="og:image" content="nao-e-url">`);
  assert.equal(m.title, "Capa");
  assert.equal(m.price, null);
  assert.equal(m.image, null);
});
