"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { go } from "@/lib/session";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) go("/login", "err", "Informe e-mail e senha.");
  const { error } = await createClient().auth.signInWithPassword({ email, password });
  if (error) go("/login", "err", "E-mail ou senha inválidos.");
  redirect("/dashboard");
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!/^\S+@\S+\.\S+$/.test(email)) go("/cadastro", "err", "E-mail inválido.");
  if (password.length < 8) go("/cadastro", "err", "A senha precisa ter pelo menos 8 caracteres.");
  const { data, error } = await createClient().auth.signUp({ email, password });
  if (error) go("/cadastro", "err", `Não foi possível cadastrar: ${error.message}`);
  // Com confirmação de e-mail ligada no Supabase, não há sessão até confirmar.
  if (!data.session) go("/login", "ok", "Cadastro criado. Confirme o e-mail enviado pelo Supabase e entre.");
  redirect("/dashboard");
}

export async function logout() {
  await createClient().auth.signOut();
  redirect("/login");
}
