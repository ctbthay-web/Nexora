import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

/** Chave só do servidor: COOKIE_KEY, ou (se não existir) derivada da chave de serviço do Supabase. Nunca vai ao navegador. */
function key(): Buffer {
  const base = process.env.COOKIE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || base.length < 20) throw new Error("sem chave de criptografia no servidor");
  return createHash("sha256").update(`nexora-cookie:${base}`).digest();
}

export function encryptText(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), ct.toString("base64")].join(":");
}

export function decryptText(enc: string): string | null {
  try {
    const [v, iv, tag, ct] = enc.split(":");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    d.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([d.update(Buffer.from(ct, "base64")), d.final()]).toString("utf8");
  } catch { return null; }
}
