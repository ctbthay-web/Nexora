import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const path = req.nextUrl.pathname;

  // O agendador chama esta rota sem sessão de usuário; ela se protege com CRON_SECRET.
  if (path.startsWith("/api/cron/")) return NextResponse.next();

  // Sem variáveis de ambiente: mostra a página de configuração.
  if (!url || !key) {
    return path === "/setup" ? NextResponse.next() : NextResponse.redirect(new URL("/setup", req.url));
  }

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll(list) {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  const isAuthPage = path === "/login" || path === "/cadastro";

  if (!user && !isAuthPage && path !== "/setup") return NextResponse.redirect(new URL("/login", req.url));
  if (user && (isAuthPage || path === "/")) return NextResponse.redirect(new URL("/dashboard", req.url));
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
