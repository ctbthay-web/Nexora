"use client";
import { useState } from "react";

export default function CopyButton({ text, label = "Copiar legenda" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="btn" onClick={async () => {
      try { await navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); } catch {}
    }}>{ok ? "Copiado!" : label}</button>
  );
}
