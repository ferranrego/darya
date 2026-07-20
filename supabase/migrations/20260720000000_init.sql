-- Darya initial schema. Plain Postgres; Supabase-specific surface is limited to
-- auth.uid() in RLS policies and the auth.users trigger (see docs/MIGRATION.md).

-- ---------------------------------------------------------------------------
-- Content mirrors (seeded from content/*.json by scripts/seed.ts)
-- ---------------------------------------------------------------------------

create table public.lexemes (
  id text primary key,
  dari text not null,
  dari_normalized text not null,
  translit text not null,
  gloss_en text not null,
  pos text not null,
  freq_rank integer not null,
  freq_band integer not null check (freq_band between 1 and 8),
  register text not null,
  variants jsonb not null default '[]',
  example_dari text not null,
  example_translit text not null,
  example_en text not null,
  audio_url text,
  tags jsonb not null default '[]'
);

create index lexemes_freq_band_idx on public.lexemes (freq_band, freq_rank);

create table public.texts (
  id text primary key,
  level text not null,
  vocab_hash text,
  source text not null check (source in ('seed', 'generated')),
  doc jsonb not null,
  created_at timestamptz not null default now()
);

create index texts_level_vocab_idx on public.texts (level, vocab_hash);

-- ---------------------------------------------------------------------------
-- Per-user state
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '',
  xp integer not null default 0,
  streak_current integer not null default 0,
  streak_best integer not null default 0,
  last_active_date date,
  daily_goal integer not null default 30,
  new_word_ratio real not null default 0.05 check (new_word_ratio between 0.01 and 0.25),
  can_read_script boolean,
  level_estimate text not null default 'L1',
  onboarded_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.user_words (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lexeme_id text not null references public.lexemes (id),
  status text not null default 'learning' check (status in ('learning', 'known')),
  due timestamptz,
  -- Full ts-fsrs Card object; `due`/`status` are duplicated out for indexing.
  fsrs jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lexeme_id)
);

create index user_words_due_idx on public.user_words (user_id, status, due);

create table public.review_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  lexeme_id text not null references public.lexemes (id),
  rating smallint not null,
  reviewed_at timestamptz not null default now(),
  log jsonb
);

create index review_logs_user_idx on public.review_logs (user_id, reviewed_at);

create table public.user_texts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  text_id text not null references public.texts (id),
  read_at timestamptz not null default now(),
  words_tapped integer not null default 0,
  primary key (user_id, text_id)
);

create table public.alphabet_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  unit_id text not null,
  completed_at timestamptz,
  correct integer not null default 0,
  total integer not null default 0,
  primary key (user_id, unit_id)
);

create table public.push_subscriptions (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text,
  created_at timestamptz not null default now()
);

create table public.daily_activity (
  user_id uuid not null references public.profiles (id) on delete cascade,
  date date not null,
  xp integer not null default 0,
  reviews_done integer not null default 0,
  texts_read integer not null default 0,
  words_learned integer not null default 0,
  primary key (user_id, date)
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger user_words_touch
  before update on public.user_words
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.lexemes enable row level security;
alter table public.texts enable row level security;
alter table public.profiles enable row level security;
alter table public.user_words enable row level security;
alter table public.review_logs enable row level security;
alter table public.user_texts enable row level security;
alter table public.alphabet_progress enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.daily_activity enable row level security;

-- Content: readable by any signed-in user; written only via service role.
create policy "lexemes readable" on public.lexemes
  for select to authenticated using (true);
create policy "texts readable" on public.texts
  for select to authenticated using (true);

-- Profiles: leaderboard-ready — all signed-in users can read every profile;
-- only the owner can update their own row.
create policy "profiles readable" on public.profiles
  for select to authenticated using (true);
create policy "profiles self-update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- Per-user tables: owner-only for everything.
create policy "user_words owner" on public.user_words
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "review_logs owner" on public.review_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "user_texts owner" on public.user_texts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "alphabet_progress owner" on public.alphabet_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "push_subscriptions owner" on public.push_subscriptions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "daily_activity owner" on public.daily_activity
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
