import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCookieInput } from "../src/lib/cookies";
import { decryptText, encryptText } from "../src/lib/crypto";

test("cookies: aceita texto e JSON do Cookie-Editor", () => {
  const a = parseCookieInput("a=1; b=2");
  assert.ok(a.ok && a.header === "a=1; b=2" && a.count === 2);
  const b = parseCookieInput(JSON.stringify([{ name: "x", value: "9", domain: ".x.com" }, { name: "y", value: "8" }]));
  assert.ok(b.ok && b.header === "x=9; y=8");
  assert.ok(!parseCookieInput("").ok);
  assert.ok(!parseCookieInput("lixo sem igual").ok);
  assert.ok(!parseCookieInput("a=1\nb=2; c=3 4").ok);
});

test("crypto: ida e volta, e valor salvo não contém o texto", () => {
  process.env.COOKIE_KEY = "k".repeat(32);
  const enc = encryptText("sessao=segredo123");
  assert.ok(!enc.includes("segredo123"));
  assert.equal(decryptText(enc), "sessao=segredo123");
  assert.equal(decryptText(enc.replace("v1", "v2")), null);
});
