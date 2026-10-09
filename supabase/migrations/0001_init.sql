-- Nexora - Fase 1: fundação. Execute no Supabase > SQL Editor.
create extension if not exists pgcrypto;

-- PERFIL (1 por usuário) ---------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  timezone text not null default 'America/Sao_Paulo',
  brand_color text not null default '#6d5efc',
  automation_status text not null default 'paused' check (automation_status in ('running','paused')),
  created_at timestamptz not null default now()
);

-- MARKETPLACES ---------------------------------------------------------------
create table if not exists public.marketplace_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace text not null check (marketplace in ('shopee','mercadolivre','amazon','magalu','shein')),
  enabled boolean not null default false,
  affiliate_id text,            -- identificador público do afiliado (NÃO é segredo)
  status text not null default 'not_configured' check (status in ('not_configured','configured','error')),
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (user_id, marketplace)
);

-- CANAIS ---------------------------------------------------------------------
create table if not exists public.channels (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('telegram','whatsapp','instagram')),
  name text not null,
  destination text,             -- ex.: @meucanal ou id do grupo. Token NÃO fica aqui.
  enabled boolean not null default true,
  status text not null default 'not_connected' check (status in ('not_connected','connected','error')),
  last_error text,
  created_at timestamptz not null default now()
);

-- PRODUTOS -------------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  marketplace text not null check (marketplace in ('shopee','mercadolivre','amazon','magalu','shein')),
  external_id text not null,
  title text not null,
  image_url text,
  price numeric(12,2) not null check (price >= 0),
  previous_price numeric(12,2),
  discount_pct numeric(5,1) generated always as (
    case when previous_price is not null and previous_price > price and previous_price > 0
         then round((previous_price - price) / previous_price * 100, 1) end
  ) stored,
  rating numeric(2,1),
  reviews_count integer,
  coupon text,
  free_shipping boolean,
  commission_pct numeric(5,2),
  category text,
  original_url text,
  affiliate_url text,
  affiliate_verified boolean not null default false,
  promo_text text,
  source text not null default 'manual' check (source in ('manual','demo','api')),
  is_demo boolean not null default false,
  favorite boolean not null default false,
  status text not null default 'found' check (status in ('found','approved','rejected','queued','published','failed')),
  data_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, marketplace, external_id)
);
create index if not exists products_user_status on public.products (user_id, status);

-- FILA DE PUBLICAÇÃO ---------------------------------------------------------
create table if not exists public.publish_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','canceled')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now()
);
-- Prevenção de duplicidade: o mesmo produto não entra 2x no mesmo canal enquanto pendente/enviado.
create unique index if not exists publish_queue_no_dupes
  on public.publish_queue (product_id, channel_id) where status in ('pending','sent');

-- LOG DE ATIVIDADES ----------------------------------------------------------
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists activity_user_time on public.activity_log (user_id, created_at desc);

-- RLS: cada usuário só enxerga e altera os próprios dados ---------------------
do $$
declare t text;
begin
  foreach t in array array['marketplace_connections','channels','products','publish_queue','activity_log'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format('create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
  end loop;
end $$;

alter table public.profiles enable row level security;
drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles for all using (auth.uid() = id) with check (auth.uid() = id);

-- Ao cadastrar: cria perfil + as 5 linhas de marketplace ----------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, split_part(new.email, '@', 1));
  insert into public.marketplace_connections (user_id, marketplace)
    select new.id, m from unnest(array['shopee','mercadolivre','amazon','magalu','shein']) as m;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
