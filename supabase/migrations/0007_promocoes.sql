-- Nexora - Promoções: templates, slogans, cupons e histórico de gerações.
-- Execute no Supabase > SQL Editor. Não apaga dados existentes.

create table if not exists public.message_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  body text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.slogans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace text check (marketplace in ('shopee','mercadolivre','amazon','magalu','shein')),
  code text not null,
  description text,
  expires_on date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_name text,
  items jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists generations_user_time on public.generations (user_id, created_at desc);

do $$
declare t text;
begin
  foreach t in array array['message_templates','slogans','coupons','generations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;
