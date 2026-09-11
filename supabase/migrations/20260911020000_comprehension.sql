-- ---------------------------------------------------------------------------
-- Did the learner actually understand the text?
-- ---------------------------------------------------------------------------
--
-- Comprehension has been checked nowhere in this app. A learner could scroll
-- to the end of a text having understood none of it, collect the points, and
-- get credit toward the next level. The `texts.questions` column has existed
-- since 20260724000000 for a feature designed as an AI call on first read -
-- which the shared free-tier quota cannot afford - so it was never written to
-- and never read.
--
-- Questions are authored content now, derived mechanically from a text's own
-- sentences where nobody has written any. What was missing was anywhere to put
-- the answer.

alter table public.user_texts add column comprehension_correct integer;
alter table public.user_texts add column comprehension_total integer;
alter table public.user_texts add column comprehension_at timestamptz;

comment on column public.user_texts.comprehension_correct is
  'Right answers on the comprehension check. Null = not taken (every row predating this, and any text too short to quiz).';

-- Null rather than 0 for "not taken" is the whole point: a learner who never
-- saw a check and a learner who scored nothing must not look the same to the
-- promotion rule that will read this.
alter table public.user_texts
  add constraint user_texts_comprehension_pair
  check (
    (comprehension_correct is null and comprehension_total is null)
    or (comprehension_correct is not null and comprehension_total is not null
        and comprehension_correct >= 0 and comprehension_correct <= comprehension_total)
  );

-- A missed comprehension question is a mistake like any other, and belongs in
-- the same record the practice session already reads from.
alter table public.learner_errors drop constraint learner_errors_kind_check;
alter table public.learner_errors
  add constraint learner_errors_kind_check
  check (kind in ('srs', 'exercise', 'grammar', 'chat', 'interference', 'comprehension'));
