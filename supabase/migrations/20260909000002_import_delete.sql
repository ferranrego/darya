-- ---------------------------------------------------------------------------
-- Deleting an import must never delete what was learned from it.
--
-- A learner finishing an article wants it out of their list; they do not want
-- to lose the words they looked up while reading it, which by then are ordinary
-- vocabulary with real SRS history. Those live in `user_lexemes` (the entry) and
-- `user_words` (the schedule), and neither has ever referenced `imported_texts`
-- - so nothing cascades today, and deletion is already safe.
--
-- What was NOT safe is `user_lexemes.source_text_id`, a bare text column
-- pointing at the import. After a delete it would point at nothing, with the
-- database unaware and a future reader with no way to tell a live id from a
-- dead one.
--
-- Making it a real foreign key with ON DELETE SET NULL fixes both halves at
-- once: the pointer is cleaned up by the database rather than by a caller who
-- has to remember, and - the important part - SET NULL is a guarantee that
-- deleting an import can only ever clear this one column. It cannot remove the
-- row. That is the property this feature depends on, and it is now enforced
-- where it cannot be bypassed rather than merely being true by omission.
--
-- The sentence the word was met in is stored inline on both rows
-- (`user_lexemes.example_target`, `user_words.context_target`), so the review
-- card keeps its context after the article is gone.
--
-- Note also that `user_lexemes` has no DELETE policy at all (see
-- 20260909000000): a personal word cannot be removed through the app by any
-- route, deliberately, because `user_words.lexeme_id` points at it.
-- ---------------------------------------------------------------------------

alter table public.user_lexemes
  add constraint user_lexemes_source_text_id_fkey
  foreign key (source_text_id) references public.imported_texts (id)
  on delete set null;
