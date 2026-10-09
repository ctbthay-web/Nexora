"use client";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme");
      const isDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      setDark(isDark);
      document.documentElement.classList.toggle("dark", isDark);
    } catch { /* sem storage: mantém claro */ }
  }, []);
  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("theme", next ? "dark" : "light"); } catch { /* ignora */ }
  }
  return <button type="button" onClick={toggle} className="btn" aria-label="Alternar tema">{dark ? "☀️ Claro" : "🌙 Escuro"}</button>;
}
