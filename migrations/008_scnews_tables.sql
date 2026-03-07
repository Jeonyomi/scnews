-- 008_scnews_tables.sql
-- Dedicated scnews tables in shared Supabase project (isolation from bcnews tables)

create table if not exists public.sc_sources (
  id bigserial primary key,
  name text not null,
  type text not null check (type in ('rss', 'web', 'official')),
  tier text,
  url text not null,
  rss_url text,
  region text check (region in ('KR', 'Global')),
  enabled boolean default true,
  last_success_at timestamptz,
  last_error_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sc_articles (
  id bigserial primary key,
  title text not null,
  source_id bigint references public.sc_sources(id) on delete set null,
  url text not null,
  canonical_url text,
  published_at_utc timestamptz,
  fetched_at_utc timestamptz not null default now(),
  language text,
  region text not null default 'Global' check (region in ('KR', 'Global')),
  content_text text,
  content_hash text,
  summary_short text,
  why_it_matters text,
  confidence_label text,
  importance_score int,
  importance_label text,
  issue_id bigint,
  status text default 'new',
  created_at timestamptz not null default now()
);

create unique index if not exists ux_sc_articles_url on public.sc_articles(canonical_url);
create unique index if not exists ux_sc_articles_hash on public.sc_articles(content_hash);
create index if not exists idx_sc_articles_published on public.sc_articles(published_at_utc desc);
create index if not exists idx_sc_articles_canonical on public.sc_articles(canonical_url);
create index if not exists idx_sc_articles_hash on public.sc_articles(content_hash);
create index if not exists idx_sc_articles_source on public.sc_articles(source_id);
create index if not exists idx_sc_articles_created on public.sc_articles(created_at desc);

create table if not exists public.sc_ingest_logs (
  id bigserial primary key,
  source_id bigint references public.sc_sources(id) on delete cascade,
  run_at_utc timestamptz not null default now(),
  status text not null,
  error_message text,
  items_fetched int not null default 0,
  items_saved int not null default 0,
  stage text
);

create index if not exists idx_sc_ingest_logs_source_run_at on public.sc_ingest_logs(source_id, run_at_utc desc);
create index if not exists idx_sc_ingest_logs_stage_run_at on public.sc_ingest_logs(stage, run_at_utc desc);
create index if not exists idx_sc_ingest_logs_run_at on public.sc_ingest_logs(run_at_utc desc);

create table if not exists public.sc_channel_posts (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','posted','skipped','failed')),
  lane text not null default 'breaking',
  article_id bigint,
  source_name text,
  headline text not null,
  headline_ko text,
  article_url text not null,
  tags text[] not null default '{}',
  post_text text not null,
  target_channel text not null default '@stablecoin_news',
  target_admin text not null default '@master_billybot',
  dedupe_key text not null unique,
  approved_by text,
  posted_at timestamptz,
  telegram_message_id bigint,
  telegram_chat_id text,
  reason text
);

create index if not exists idx_sc_channel_posts_status_created_at
  on public.sc_channel_posts(status, created_at desc);
create index if not exists idx_sc_channel_posts_lane_status
  on public.sc_channel_posts(lane, status);
create index if not exists idx_sc_channel_posts_status_reason
  on public.sc_channel_posts(status, reason, created_at desc);

-- cursor state for scnews ingest round-robin
create table if not exists public.sc_ingest_state (
  state_key text primary key,
  cursor_source_id bigint,
  last_run_at_utc timestamptz,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.sc_sources to anon;
grant select, insert, update, delete on public.sc_articles to anon;
grant select, insert, update, delete on public.sc_ingest_logs to anon;
grant select, insert, update, delete on public.sc_channel_posts to anon;
grant select, insert, update, delete on public.sc_ingest_state to anon;
