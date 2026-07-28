-- ---------------------------------------------------------------------------
-- Purge AI caches whose jsonb payloads predate the dari -> target rename.
--
-- Same root cause as 20260728000002 (texts.doc): the rename moved SQL columns
-- and content/ JSON, but these columns hold opaque jsonb written by the AI
-- pipeline, so rows cached before the rename still carry `sentenceDari`,
-- `correctSentenceDari`, `dari`, etc. The new code reads the target* names,
-- gets undefined, and throws in the same way the reader did.
--
-- Unlike texts.doc these are NOT migrated but deleted, because:
--   * both are pure caches, regenerated on demand from the lexicon;
--   * the three exercise types each nest the old keys differently, so a
--     rewrite would be three fiddly, hard-to-verify jsonb transforms;
--   * user_exercises.exercise_id is ON DELETE CASCADE, so the dependent rows
--     clean themselves up. The only user-visible effect is that a handful of
--     already-completed practice items may be offered again.
--
-- texts.doc could not be treated this way: user_texts.text_id references it and
-- deleting would have destroyed reading history.
--
-- Idempotent: matches only rows still containing an old key name.
-- ---------------------------------------------------------------------------

-- Word-by-word sentence glosses, keyed by sentence hash. 7/7 were stale.
delete from public.sentence_explanations
where explanation::text like '%"dari"%';

-- Generated practice items: cloze / unscramble / grammar_detective carry the
-- sentence under the renamed keys. (realia is English + Markdown, unaffected.)
delete from public.exercises
where data::text like '%"sentenceDari"%'
   or data::text like '%"correctSentenceDari"%'
   or data::text like '%"incorrectSentenceDari"%'
   or data::text like '%"distractorsDari"%'
   or data::text like '%"wordDari"%';
