-- ---------------------------------------------------------------------------
-- Has this learner ever actually written this word?
-- ---------------------------------------------------------------------------
--
-- Every flashcard in this app has been recognition: show the Dari, ask "do you
-- remember this?", reveal the English, press Forgot or Got it. The learner
-- grades themselves - and everyone is generous with themselves when the answer
-- is already on screen - and recognising a word is a different skill from
-- producing one. A word "graduates" to known purely on accumulated
-- self-report, and there has been no point anywhere in the app where a learner
-- writes a Dari word.
--
-- These two columns are what makes "known" mean something: a word counts as
-- known only once it has been produced correctly at least once, and the app
-- can tell the gap between recognising and producing - which it currently
-- cannot measure at all.

alter table public.user_words add column produced_at timestamptz;
alter table public.user_words add column produced_count integer not null default 0;

comment on column public.user_words.produced_at is
  'First time the learner wrote this word correctly. Null = never produced, including every row predating this column.';
comment on column public.user_words.produced_count is
  'How many times it has been produced correctly. Recognition reviews never touch this.';

-- Null rather than backfilled: a word an existing learner already has at
-- "known" was graduated on self-report, and pretending it was produced would
-- destroy the one measurement these columns exist to make.

create index user_words_produced_idx on public.user_words (user_id, produced_at);
