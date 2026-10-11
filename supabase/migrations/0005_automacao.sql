-- Nexora - Automação: Telegram real, IA (Gemini), fila com retentativas e agendador.
-- Execute no Supabase > SQL Editor. Não apaga dados existentes.

-- Bot do Telegram (token digitado na tela do app; nunca volta para o navegador) -------------
create table if not exists public.telegram_bot (
  user_id uuid primary key references auth.users(id) on delete cascade,
  bot_token text not null,
  bot_id bigint,
  bot_username text,
  validated_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.telegram_bot enable row level security;
drop policy if exists "own rows" on public.telegram_bot;
create policy "own rows" on public.telegram_bot for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Canais: mais estados de conexão ------------------------------------------------------------
alter table public.channels drop constraint if exists channels_status_check;
alter table public.channels add constraint channels_status_check
  check (status in ('not_connected','connected','error','awaiting_auth','invalid_credentials','needs_attention'));
alter table public.channels add column if not exists last_checked_at timestamptz;

-- Produtos: avaliação da IA ------------------------------------------------------------------
alter table public.products add column if not exists ai_score integer check (ai_score between 0 and 10);
alter table public.products add column if not exists ai_notes text;
alter table public.products add column if not exists ai_evaluated_at timestamptz;

-- Fila de publicação: legenda final, retentativas, retorno da plataforma -----------------------
alter table public.publish_queue drop constraint if exists publish_queue_status_check;
alter table public.publish_queue add constraint publish_queue_status_check
  check (status in ('pending','sending','sent','failed','canceled'));
alter table public.publish_queue add column if not exists caption text;
alter table public.publish_queue add column if not exists next_attempt_at timestamptz;
alter table public.publish_queue add column if not exists sent_at timestamptz;
alter table public.publish_queue add column if not exists external_message_id text;
alter table public.publish_queue add column if not exists response jsonb;
alter table public.publish_queue add column if not exists updated_at timestamptz not null default now();
create index if not exists publish_queue_due on public.publish_queue (status, scheduled_for);
drop index if exists public.publish_queue_no_dupes;
create unique index publish_queue_no_dupes
  on public.publish_queue (product_id, channel_id) where status in ('pending','sending','sent');

-- Configuração da automação (1 por usuário) ---------------------------------------------------
create table if not exists public.automation_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  post_times text[] not null default array['09:00','13:00','19:00'],   -- horários de publicação (fuso do perfil)
  weekdays integer[] not null default array[0,1,2,3,4,5,6],            -- 0=domingo ... 6=sábado
  run_time text not null default '07:00',                              -- horário da rotina diária (coleta + IA)
  max_posts_per_day integer not null default 5 check (max_posts_per_day between 1 and 50),
  max_products_per_run integer not null default 10 check (max_products_per_run between 1 and 50),
  approval_mode text not null default 'manual' check (approval_mode in ('manual','auto')),
  min_score integer not null default 7 check (min_score between 0 and 10),
  search_terms text[] not null default '{}',
  ai_daily_limit integer not null default 40 check (ai_daily_limit between 0 and 500),
  last_run_at timestamptz,
  last_tick_at timestamptz,                                            -- último sinal do agendador do servidor
  updated_at timestamptz not null default now()
);
alter table public.automation_settings enable row level security;
drop policy if exists "own rows" on public.automation_settings;
create policy "own rows" on public.automation_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Histórico de execuções -----------------------------------------------------------------------
create table if not exists public.automation_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'daily' check (kind in ('daily','manual','publish')),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null default 'running' check (status in ('running','ok','partial','failed')),
  steps jsonb not null default '[]'::jsonb,
  error text
);
create index if not exists automation_runs_user_time on public.automation_runs (user_id, started_at desc);
alter table public.automation_runs enable row level security;
drop policy if exists "own rows" on public.automation_runs;
create policy "own rows" on public.automation_runs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Controle de custo da IA (chamadas por dia) --------------------------------------------------
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  calls integer not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
drop policy if exists "own rows" on public.ai_usage;
create policy "own rows" on public.ai_usage for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
