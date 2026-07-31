-- Widen lexemes.freq_band from 8 bands to 10.
--
-- The application has used ten bands since FREQ_BAND_COUNT was introduced
-- (src/lib/content/schema.ts), and the corpus-derived re-ranking now places
-- 1,216 Catalan and 1,689 Dari lexemes in bands 9 and 10. The table still
-- carried `check (freq_band between 1 and 8)` from the initial schema, so the
-- database and the content disagreed about what a valid band is.
--
-- The failure is worse than a rejected row. scripts/seed.ts upserts every
-- lexeme in a single statement, so the first band-9 row aborts the whole
-- upsert and *no* lexeme is written at all - leaving the table holding an old
-- vocabulary while the app serves the new one. A learner then taps a word that
-- exists in the shipped lexicon but has no row here, and the user_words insert
-- fails its foreign key with nothing in the UI to say so: the word is never
-- learned, never scheduled, and never counted towards the next level.
--
-- Widening is safe in both directions - every existing row is in 1..8, which
-- still satisfies the new constraint - so this can be applied before the code
-- that needs it, and must be, since seeding depends on it.

alter table public.lexemes drop constraint if exists lexemes_freq_band_check;

alter table public.lexemes
  add constraint lexemes_freq_band_check check (freq_band between 1 and 10);
