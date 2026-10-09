import Link from "next/link";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { login } from "../actions";

export default function LoginPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-4">
      <h1 className="mb-1 text-2xl font-bold text-brand">Nexora</h1>
      <p className="mb-6 text-sm text-muted">Entre para gerenciar seus achadinhos.</p>
      <Flash searchParams={searchParams} />
      <form action={login} className="card space-y-3">
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" required className="input" /></div>
        <div><label className="label" htmlFor="password">Senha</label><input id="password" name="password" type="password" required className="input" /></div>
        <SubmitButton className="btn btn-primary w-full">Entrar</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm text-muted">Não tem conta? <Link href="/cadastro" className="text-brand underline">Cadastre-se</Link></p>
    </main>
  );
}
