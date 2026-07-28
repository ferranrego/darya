-- ---------------------------------------------------------------------------
-- Transliteration becomes optional at the database level.
--
-- Content format 1.4.0 made `translit` / `exampleTranslit` / `titleTranslit`
-- optional, because a language already written in Latin script has nothing to
-- transliterate. The Zod schemas were relaxed but these columns were not, so
-- seeding a Latin-script language failed on a NOT NULL violation.
--
-- Whether a transliteration is *required* is a property of the language, not of
-- the schema: validate-content enforces it for any profile that declares
-- capabilities.transliteration (Dari does), so dropping the constraint here
-- loses no safety for Dari while letting Catalan seed at all.
--
-- Widening only - no data is read, moved or dropped, and existing rows are
-- unaffected. Safe to apply to a populated database.
-- ---------------------------------------------------------------------------

alter table public.lexemes alter column translit drop not null;
alter table public.lexemes alter column example_translit drop not null;

alter table public.lexeme_context_sentences alter column translit drop not null;
