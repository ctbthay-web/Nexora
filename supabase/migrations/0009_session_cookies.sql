-- Cookie de sessão colado pela usuária (guardado CRIPTOGRAFADO; a chave fica só no servidor).
create table if not exists public.session_cookies (
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace text not null,
  cookie_enc text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, marketplace)
);
alter table public.session_cookies enable row level security;
drop policy if exists "own rows" on public.session_cookies;
create policy "own rows" on public.session_cookies for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
