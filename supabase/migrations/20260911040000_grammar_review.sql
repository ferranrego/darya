-- ---------------------------------------------------------------------------
-- Grammar comes back
-- ---------------------------------------------------------------------------
--
-- Ninety-three lessons and 589 written exercises, and completing a lesson once
-- marks it done forever: no review, no repetition, nothing that brings the
-- point back a week later. Vocabulary has had a scheduler since the first
-- migration; grammar has had a checkbox.
--
-- One card per lesson, not per exercise. The thing being remembered is the
-- grammar point - "the present tense takes mē-" - and a review draws one of
-- that lesson's own written exercises to ask it with. That is what makes this
-- free: the 589 exercises already exist, so grammar review costs no model call,
-- where today's "extra practice" button is a generation.
--
-- Same `fsrs` jsonb as user_words, deliberately: the scheduler is unchanged and
-- shared, so grammar and vocabulary cannot drift into two different ideas of
-- when something is due.

create table public.grammar_cards (
  user_id uuid not null references public.profiles (id) on delete cascade,
  lesson_id text not null,
  due timestamptz,
  fsrs jsonb,
  -- Kept so a lesson that keeps lapsing is visible without joining the whole
  -- review history back together.
  lapses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create index grammar_cards_due_idx on public.grammar_cards (user_id, due);

alter table public.grammar_cards enable row level security;
create policy "grammar_cards owner" on public.grammar_cards
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

comment on table public.grammar_cards is
  'Spaced review of grammar points. One card per lesson; the review question is drawn from that lesson''s own written exercises, so it costs no model call.';
