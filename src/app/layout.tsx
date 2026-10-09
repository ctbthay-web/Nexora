import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Nexora — Achadinhos & Afiliados",
  description: "Plataforma de achadinhos e automação de afiliados",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
