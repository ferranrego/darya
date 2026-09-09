-- ---------------------------------------------------------------------------
-- Remember that a token is a proper noun.
--
-- A news article is full of names, and they repeat: "احمد شاه مسعود" occurs
-- throughout the article this was written for. Looking one up costs a model
-- call, and without somewhere to record the answer every occurrence - and every
-- re-reading - costs another, on a quota shared by every learner of the
-- deployment. Names are also the one lookup that produces no dictionary entry,
-- so there was nowhere for the answer to go.
--
-- Marking every matching token in the document is both the cost fix and the
-- display fix: the reader renders a `kind: "name"` token unstyled and never
-- offers it as vocabulary again.
-- ---------------------------------------------------------------------------

create function public.mark_imported_name(p_id text, p_surface text)
returns void
language sql
security invoker
as $$
  update public.imported_texts
     set doc = jsonb_set(
       doc,
       '{sentences}',
       coalesce((
         select jsonb_agg(
           jsonb_set(
             s,
             '{tokens}',
             coalesce((
               select jsonb_agg(
                 case when t ->> 'surface' = p_surface
                      then t || '{"kind":"name"}'::jsonb
                      else t
                 end
                 order by ti
               )
               from jsonb_array_elements(s -> 'tokens') with ordinality tt(t, ti)
             ), '[]'::jsonb)
           )
           order by si
         )
         from jsonb_array_elements(doc -> 'sentences') with ordinality ss(s, si)
       ), '[]'::jsonb)
     )
   where id = p_id and user_id = auth.uid();
$$;
