-- ---------------------------------------------------------------------------
-- Sentence Explanations, cached per sentence hash (shared across all readers)
-- ---------------------------------------------------------------------------
--
-- Stores word-by-word glosses and structural explanations of Dari sentences.
-- The hash is a sha256 hex string of the normalized Dari sentence.

CREATE TABLE public.sentence_explanations (
    sentence_hash text primary key,
    explanation jsonb not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.sentence_explanations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON public.sentence_explanations FOR SELECT USING (true);
