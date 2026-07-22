-- ---------------------------------------------------------------------------
-- Add Context Fields to User Words for Sentence-Level SRS
-- ---------------------------------------------------------------------------

alter table public.user_words
  add column context_dari text,
  add column context_translit text,
  add column context_en text;
