-- The learner's one-time choice about words from levels below their assessed
-- level: 'seeded' = bulk-marked as known, 'manual' = they mark words themselves
-- while reading. Null = not asked yet (prompted before their second text).
alter table public.profiles
  add column prior_words_decision text
  check (prior_words_decision in ('seeded', 'manual'));
