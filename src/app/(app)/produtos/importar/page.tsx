import Bookmarklet from "@/components/Bookmarklet";
import { requireUser } from "@/lib/session";
import { headers } from "next/headers";
import ImportList from "./ImportList";

export default async function ImportPage() {
  await requireUser();
  const h = headers();
  const origin = `https://${h.get("x-forwarded-host") ?? h.get("host")}`;
  return (
    <div className="max-w-4xl space-y-4">
      <h1 className="text-2xl font-bold">Importar ofertas do Mercado Livre</h1>
      <p className="text-xs text-muted">Os dados são lidos da página do Mercado Livre que você mesma abriu (preço, preço anterior, foto e link). O Nexora não inventa preço, cupom nem frete, e não gera link de afiliado: depois de salvar, cole o seu em Editar.</p>
      <ImportList />
      <Bookmarklet origin={origin} />
    </div>
  );
}
