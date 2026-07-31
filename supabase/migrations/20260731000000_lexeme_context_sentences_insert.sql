-- Add INSERT policy for lexeme_context_sentences
create policy "Authenticated users can insert context sentences"
  on public.lexeme_context_sentences for insert
  to authenticated
  with check (true);
