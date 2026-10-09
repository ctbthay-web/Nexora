import Flash from "@/components/Flash";
import ProductForm from "../ProductForm";

export default function NewProduct({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">Novo produto</h1>
      <Flash searchParams={searchParams} />
      <ProductForm />
    </div>
  );
}
