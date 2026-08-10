-- Curriculum order within a level, for the authored seed-text corpus.
--
-- Authored texts are meant to be read in a specific order - each one's
-- `newWords` is measured against what the texts before it at the same level
-- already introduced (see scripts/build-seed-texts.ts) - and nothing recorded
-- that order once a text left content/texts/seed/ and became a row here.
-- Nullable: every text cached before this column existed (every generated
-- text, and every seed text seeded before this migration) has no `seq`, and
-- getTextsForLevel sorts those after the ones that do rather than treating a
-- missing value as an error.
--
-- Not widening the `source` check: 'seed' already means "hand-authored,
-- always shown" (see text-pool.selectUnread), and a third value would risk a
-- live constraint change for no benefit this column doesn't already provide.

alter table public.texts add column if not exists seq integer;
create index if not exists texts_level_seq_idx on public.texts (level, seq);
