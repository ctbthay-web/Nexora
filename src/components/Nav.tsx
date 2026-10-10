"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "📊" },
  { href: "/buscar", label: "Buscar", icon: "🔎" },
  { href: "/produtos", label: "Produtos", icon: "🛍️" },
  { href: "/fila", label: "Fila", icon: "🗓️" },
  { href: "/marketplaces", label: "Marketplaces", icon: "🏬" },
  { href: "/canais", label: "Canais", icon: "📣" },
  { href: "/configuracoes", label: "Configurações", icon: "⚙️" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
      {ITEMS.map((i) => {
        const active = path === i.href || path.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium ${
              active ? "bg-brand text-white" : "text-fg hover:bg-line/60"
            }`}
          >
            <span aria-hidden>{i.icon}</span>
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
