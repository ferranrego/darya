-- ---------------------------------------------------------------------------
-- Comprehension questions, cached per text (shared across all readers)
-- ---------------------------------------------------------------------------
--
-- Generated on demand the first time any learner finishes a text, then reused
-- for everyone — the same cache-once-share-forever pattern as generated texts
-- themselves. Null until generated; an empty array means "generated, none
-- worth asking" (e.g. a text too short to quiz).

alter table public.texts add column questions jsonb;
