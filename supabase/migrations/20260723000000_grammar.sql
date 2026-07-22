-- Grammar course: per-user lesson progress + shared cache of AI-generated
-- practice exercises.

create table public.grammar_progress (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id text not null,
  completed_at timestamptz,
  correct integer not null default 0,
  total integer not null default 0,
  primary key (user_id, lesson_id)
);

alter table public.grammar_progress enable row level security;
create policy "grammar_progress owner" on public.grammar_progress
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI practice pool: readable by any signed-in user, written only via service
-- role. Items are shared across users so generation runs only when the pool
-- for a lesson is dry.
create table public.grammar_practice (
  id bigint generated always as identity primary key,
  lesson_id text not null,
  exercise jsonb not null,
  model text,
  created_at timestamptz not null default now()
);

create index grammar_practice_lesson_idx on public.grammar_practice (lesson_id);

alter table public.grammar_practice enable row level security;
create policy "grammar_practice readable" on public.grammar_practice
  for select to authenticated using (true);
