-- Nexora - Shopee: guarda o App ID e a Secret da API de afiliados (Open API) do usuário.
-- A Secret nunca é devolvida à tela. Execute no Supabase > SQL Editor.
create table if not exists public.shopee_api (
  user_id uuid primary key references auth.users(id) on delete cascade,
  app_id text not null,
  app_secret text not null,
  updated_at timestamptz not null default now()
);
alter table public.shopee_api enable row level security;
drop policy if exists "own rows" on public.shopee_api;
create policy "own rows" on public.shopee_api for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
