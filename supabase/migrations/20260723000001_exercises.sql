-- ---------------------------------------------------------------------------
-- Practice & Exercises Table
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('cloze', 'unscramble', 'realia', 'grammar_detective')),
  data jsonb not null,
  lexeme_ids text[] not null default '{}',
  level text not null,
  created_at timestamptz not null default now()
);

-- Index for querying exercises by level
create index exercises_level_idx on public.exercises (level);

create table public.user_exercises (
  user_id uuid not null references public.profiles (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  completed_at timestamptz not null default now(),
  is_correct boolean not null,
  primary key (user_id, exercise_id)
);

-- RLS Policies
alter table public.exercises enable row level security;
alter table public.user_exercises enable row level security;

-- Exercises are readable by all authenticated users, but only writable by service_role (AI pipeline)
create policy "exercises readable" on public.exercises
  for select to authenticated using (true);

-- User exercises are only accessible by the owner
create policy "user_exercises owner" on public.user_exercises
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
