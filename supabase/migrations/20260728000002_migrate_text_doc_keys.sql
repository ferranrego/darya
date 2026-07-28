-- ---------------------------------------------------------------------------
-- Rename the dari* keys inside texts.doc to target*.
--
-- The dari -> target rename (20260728000001) renamed SQL *columns*, and
-- scripts/seed.ts rewrote the eight seed texts from content/. But `texts.doc`
-- is an opaque jsonb blob that db/texts.ts casts rather than zod-parses, so the
-- 32 AI-generated texts already cached in the database kept the old shape.
--
-- text-reader.tsx does `doc.sentences.map(s => s.target.length)`, which throws
-- on those rows. A user whose history contains a generated text therefore gets
-- a blank reader, while a user with no generated history is unaffected - which
-- is exactly the split observed between two accounts.
--
-- These rows cannot simply be purged: user_texts.text_id references texts(id),
-- so deleting them would destroy reading history. Rewrite the keys instead.
--
-- Idempotent: only touches rows that still carry an old key, and re-running is
-- a no-op. Sentence order is preserved via WITH ORDINALITY + ORDER BY, which
-- jsonb_agg does not guarantee otherwise.
-- ---------------------------------------------------------------------------

update public.texts t
set doc =
  (
    case
      when t.doc ? 'titleDari'
        then (t.doc - 'titleDari') || jsonb_build_object('titleTarget', t.doc -> 'titleDari')
      else t.doc
    end
  )
  || jsonb_build_object(
       'sentences',
       (
         select jsonb_agg(
                  case
                    when s ? 'dari'
                      then (s - 'dari') || jsonb_build_object('target', s -> 'dari')
                    else s
                  end
                  order by ord
                )
         from jsonb_array_elements(t.doc -> 'sentences') with ordinality as e(s, ord)
       )
     )
where jsonb_typeof(t.doc -> 'sentences') = 'array'
  and (
    t.doc ? 'titleDari'
    or exists (
      select 1 from jsonb_array_elements(t.doc -> 'sentences') x where x ? 'dari'
    )
  );
