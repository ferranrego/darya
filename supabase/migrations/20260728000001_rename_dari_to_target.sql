-- ---------------------------------------------------------------------------
-- Rename the language-neutral data columns from dari* to target*.
--
-- "The text in the language being learned" is not a Dari-specific concept, and
-- this schema is about to serve a second target language. Renaming now, while
-- Dari is still the only one, keeps it a single mechanical change.
--
-- Matches the same rename applied to content/*.json keys and the TypeScript
-- field names in the same commit (scripts/rename-dari-to-target.ts). The
-- repository layer in src/lib/db/ selects with `*` and maps by field name, so
-- these must land together.
--
-- Renames only - no data is read, moved or dropped.
-- ---------------------------------------------------------------------------

alter table public.lexemes rename column dari to target;
alter table public.lexemes rename column dari_normalized to target_normalized;
alter table public.lexemes rename column example_dari to example_target;

alter table public.user_words rename column context_dari to context_target;

alter table public.lexeme_context_sentences rename column dari to target;
