-- ---------------------------------------------------------------------------
-- Lexeme Context Sentences
-- Shared cache for AI-generated rotating context sentences in flashcards.
-- ---------------------------------------------------------------------------

create table public.lexeme_context_sentences (
  id uuid default gen_random_uuid() primary key,
  lexeme_id text not null,
  dari text not null,
  translit text not null,
  en text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index lexeme_context_sentences_lexeme_id_idx on public.lexeme_context_sentences(lexeme_id);

alter table public.lexeme_context_sentences enable row level security;

create policy "Lexeme context sentences are viewable by everyone"
  on public.lexeme_context_sentences for select
  using (true);
