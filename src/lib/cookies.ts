const NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;
const VALUE = /^[^\x00-\x1f\x7f;\s]*$/;

/**
 * Aceita o cookie em dois formatos: texto "a=1; b=2" ou o JSON exportado pelo Cookie-Editor.
 * Devolve o cabeçalho "a=1; b=2" pronto, ou um erro em português.
 */
export function parseCookieInput(raw: string): { ok: true; header: string; count: number } | { ok: false; error: string } {
  const text = raw.trim();
  if (!text) return { ok: false, error: "Cole o cookie." };
  if (text.length > 12000) return { ok: false, error: "Cookie grande demais." };
  const pairs: [string, string][] = [];
  if (text.startsWith("[") || text.startsWith("{")) {
    let data: any;
    try { data = JSON.parse(text); } catch { return { ok: false, error: "JSON do Cookie-Editor inválido. Exporte de novo (Export → JSON)." }; }
    const list = Array.isArray(data) ? data : [data];
    for (const c of list) if (c && typeof c.name === "string" && typeof c.value === "string") pairs.push([c.name, c.value]);
  } else {
    for (const part of text.replace(/^cookie:\s*/i, "").split(";")) {
      const i = part.indexOf("=");
      if (i > 0) pairs.push([part.slice(0, i).trim(), part.slice(i + 1).trim()]);
    }
  }
  if (!pairs.length) return { ok: false, error: "Não encontrei nenhum cookie nesse texto." };
  for (const [n, v] of pairs) {
    if (!NAME.test(n)) return { ok: false, error: `Nome de cookie inválido: ${n.slice(0, 30)}` };
    if (!VALUE.test(v)) return { ok: false, error: `Valor inválido no cookie ${n}.` };
  }
  return { ok: true, header: pairs.map(([n, v]) => `${n}=${v}`).join("; "), count: pairs.length };
}
