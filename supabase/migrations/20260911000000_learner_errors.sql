-- ---------------------------------------------------------------------------
-- Remember what a learner got wrong.
--
-- Today the app throws that away. `review_logs.rating` is written and read by
-- no screen or route. `user_exercises` is keyed (user_id, exercise_id), so a
-- second attempt at the same item is an insert conflict the client swallows,
-- and which wrong answer was chosen is never stored at all. Tutor corrections
-- - the most diagnostic thing the app produces about a learner's actual Dari -
-- are deleted by pg_cron after 48 hours along with the message.
--
-- So the single highest-value move available to any teacher, "notice what this
-- person keeps getting wrong and teach that again", is not merely missing: it
-- is impossible to build. This migration is what makes it possible. Nothing
-- reads these rows yet; that is deliberate, so the write path can be shipped
-- and verified before anything depends on it.
-- ---------------------------------------------------------------------------

-- --- 1. Mistakes ------------------------------------------------------------
create table public.learner_errors (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Which surface produced it, so re-teaching can be routed back there.
  kind text not null check (kind in ('srs', 'exercise', 'grammar', 'chat', 'interference')),
  -- What it was about. A vocabulary mistake carries a lexeme, a grammar one a
  -- grammarPoint; both are null for a free-text chat correction.
  lexeme_id text,
  grammar_point text,
  -- The item, where there is one: an exercises.id, a grammar exercise id.
  item_id text,
  -- What the learner produced and what was wanted. Deliberately the token or
  -- phrase, never a whole message: a tutor correction already reports its
  -- issues as {before, after}, and storing those rather than the sentence
  -- keeps the teaching signal without extending how long anything a learner
  -- wrote is kept. The 48h chat purge stays exactly as it is.
  given text,
  expected text,
  -- One sentence of English, when the source produced one.
  why_en text,
  occurred_at timestamptz not null default now(),
  -- Set when the learner later gets the same thing right.
  resolved_at timestamptz
);

-- The two questions this table exists to answer: "what is still unresolved for
-- this learner" and "how are they doing on this particular word".
create index learner_errors_open_idx
  on public.learner_errors (user_id, resolved_at, occurred_at desc);
create index learner_errors_lexeme_idx
  on public.learner_errors (user_id, lexeme_id)
  where lexeme_id is not null;

alter table public.learner_errors enable row level security;

create policy "learner_errors are private"
  on public.learner_errors for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- A `ux-` lexeme belongs to one learner, which no foreign key can express -
-- reuse the trigger written for user_words rather than a second copy of the
-- rule. See 20260909000001_lexeme_ref.sql for the incident behind it.
create trigger learner_errors_lexeme_ref
  before insert or update on public.learner_errors
  for each row when (new.lexeme_id is not null)
  execute function public.assert_lexeme_ref();

-- --- 2. Let an exercise be attempted more than once -------------------------
--
-- The composite primary key meant one row per (learner, exercise) forever, so
-- a repeat attempt could not be recorded and the app quietly discarded it.
-- That is precisely the attempt worth having: it is the one that shows whether
-- re-teaching worked.
alter table public.user_exercises drop constraint user_exercises_pkey;
alter table public.user_exercises add column id bigint generated always as identity primary key;
alter table public.user_exercises add column chosen_answer text;
alter table public.user_exercises add column correct_answer text;
alter table public.user_exercises add column attempt integer not null default 1;
alter table public.user_exercises add column latency_ms integer;

-- The route asks "which exercises has this learner already seen"; that now
-- means "at least once" rather than "has a row", which is what lets a missed
-- item come back.
create index user_exercises_recent_idx
  on public.user_exercises (user_id, exercise_id, completed_at desc);

-- --- 3. A learner's own day -------------------------------------------------
--
-- `record_activity` hardcoded Barcelona midnight for everyone on earth, so a
-- learner in Kabul lost their streak at half past two in the afternoon. Null
-- keeps every existing row on the old behaviour.
alter table public.profiles add column timezone text;

create or replace function public.record_activity(
  xp_delta integer default 0,
  reviews integer default 0,
  texts integer default 0,
  words integer default 0
)
returns public.profiles
language plpgsql
security invoker set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.profiles;
  today date;
begin
  if uid is null then
    raise exception 'record_activity requires an authenticated user';
  end if;

  if xp_delta not between 0 and 50
     or reviews not between 0 and 10
     or texts not between 0 and 10
     or words not between 0 and 10 then
    raise exception 'activity delta out of range';
  end if;

  -- Read the profile before computing the day: "today" is a property of the
  -- learner, not of the server. Europe/Madrid remains the fallback so a row
  -- with no timezone behaves exactly as it did before.
  select * into p from profiles where id = uid for update;
  today := (now() at time zone coalesce(p.timezone, 'Europe/Madrid'))::date;

  insert into daily_activity as da (user_id, date, xp, reviews_done, texts_read, words_learned)
  values (uid, today, xp_delta, reviews, texts, words)
  on conflict (user_id, date) do update set
    xp = da.xp + excluded.xp,
    reviews_done = da.reviews_done + excluded.reviews_done,
    texts_read = da.texts_read + excluded.texts_read,
    words_learned = da.words_learned + excluded.words_learned;

  if p.last_active_date is distinct from today then
    if p.last_active_date = today - 1 then
      p.streak_current := p.streak_current + 1;
    else
      p.streak_current := 1;
    end if;
    p.streak_best := greatest(p.streak_best, p.streak_current);
  end if;

  update profiles set
    xp = profiles.xp + xp_delta,
    streak_current = p.streak_current,
    streak_best = p.streak_best,
    last_active_date = today
  where id = uid
  returning * into p;

  return p;
end;
$$;

revoke execute on function public.record_activity from public, anon;
grant execute on function public.record_activity to authenticated;
