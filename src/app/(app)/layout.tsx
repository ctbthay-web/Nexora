import Nav from "@/components/Nav";
import ThemeToggle from "@/components/ThemeToggle";
import SubmitButton from "@/components/SubmitButton";
import { requireUser } from "@/lib/session";
import { logout } from "../(auth)/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, user } = await requireUser();
  const { data: prof } = await supabase.from("profiles").select("brand_color").eq("id", user.id).single();
  const brand = /^#[0-9a-fA-F]{6}$/.test(prof?.brand_color ?? "") ? prof!.brand_color : "#6d5efc";
  return (
    <div className="min-h-screen md:flex" style={{ ["--brand" as any]: brand }}>
      <aside className="border-b border-line bg-card p-3 md:sticky md:top-0 md:h-screen md:w-60 md:shrink-0 md:border-b-0 md:border-r md:p-4">
        <div className="mb-3 flex items-center justify-between md:mb-6">
          <span className="text-lg font-bold text-brand">Nexora</span>
          <span className="md:hidden"><ThemeToggle /></span>
        </div>
        <Nav />
        <div className="mt-6 hidden space-y-2 md:block">
          <ThemeToggle />
          <p className="truncate text-xs text-muted">{user.email}</p>
          <form action={logout}><SubmitButton className="btn w-full">Sair</SubmitButton></form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 md:p-8">{children}</main>
    </div>
  );
}
