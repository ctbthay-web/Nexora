import { notFound } from "next/navigation";
import Flash from "@/components/Flash";
import { requireUser } from "@/lib/session";
import ProductForm from "../ProductForm";

export default async function EditProduct({
  params, searchParams,
}: { params: { id: string }; searchParams: { ok?: string; err?: string } }) {
  const { supabase } = await requireUser();
  const { data: p } = await supabase.from("products").select("*").eq("id", params.id).maybeSingle();
  if (!p) notFound();
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Editar produto</h1>
      <Flash searchParams={searchParams} />
      <ProductForm p={p} />
    </div>
  );
}
