import Link from "next/link";
import Flash from "@/components/Flash";
import SubmitButton from "@/components/SubmitButton";
import { signup } from "../actions";

export default function SignupPage({ searchParams }: { searchParams: { ok?: string; err?: string } }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-4">
      <h1 className="mb-1 text-2xl font-bold text-brand">Criar conta</h1>
      <p className="mb-6 text-sm text-muted">Seus dados ficam isolados dos de outros usuários.</p>
      <Flash searchParams={searchParams} />
      <form action={signup} className="card space-y-3">
        <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" required className="input" /></div>
        <div><label className="label" htmlFor="password">Senha (mín. 8 caracteres)</label><input id="password" name="password" type="password" minLength={8} required className="input" /></div>
        <SubmitButton className="btn btn-primary w-full">Cadastrar</SubmitButton>
      </form>
      <p className="mt-4 text-center text-sm text-muted">Já tem conta? <Link href="/login" className="text-brand underline">Entrar</Link></p>
    </main>
  );
}
