"use client";
import { useFormStatus } from "react-dom";

export default function SubmitButton({
  children, className = "btn btn-primary", confirm,
}: { children: React.ReactNode; className?: string; confirm?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      onClick={(e) => { if (confirm && !window.confirm(confirm)) e.preventDefault(); }}
    >
      {pending ? "Aguarde…" : children}
    </button>
  );
}
