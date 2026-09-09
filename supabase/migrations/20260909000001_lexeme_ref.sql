-- ---------------------------------------------------------------------------
-- user_words / review_logs: allow personal (`ux-`) lexeme ids.
--
-- Both columns were `references public.lexemes (id)`. Personal dictionary
-- entries from imported articles live in public.user_lexemes, not
-- public.lexemes, so the FK has to go - but dropping it outright would give up
-- exactly the guarantee CLAUDE.md #4 names ("user_words.lexeme_id is a foreign
-- key ... dropping an entry orphans real learner progress"). A CHECK on the id
-- shape is not a replacement for that: it accepts `lx-9999` whether or not any
-- such lexeme exists.
--
-- So: CHECK for the shape, plus a trigger for the reference. The trigger is
-- strictly stronger than the FK it replaces, because it also enforces that a
-- `ux-` id belongs to the SAME user - an ownership rule no foreign key can
-- express. scripts/validate-db.ts additionally sweeps for rows orphaned by a
-- later content edit, which no constraint can catch.
-- ---------------------------------------------------------------------------

alter table public.user_words drop constraint user_words_lexeme_id_fkey;
alter table public.review_logs drop constraint review_logs_lexeme_id_fkey;

alter table public.user_words
  add constraint user_words_lexeme_id_shape
  check (lexeme_id ~ '^lx-[0-9]{4,}$' or lexeme_id ~ '^ux-[0-9a-f]{8,}$');

alter table public.review_logs
  add constraint review_logs_lexeme_id_shape
  check (lexeme_id ~ '^lx-[0-9]{4,}$' or lexeme_id ~ '^ux-[0-9a-f]{8,}$');

create function public.assert_lexeme_ref() returns trigger
language plpgsql
as $$
begin
  if new.lexeme_id like 'ux-%' then
    if not exists (
      select 1 from public.user_lexemes ul
       where ul.id = new.lexeme_id and ul.user_id = new.user_id
    ) then
      raise exception 'lexeme_id % is not a personal lexeme belonging to user %',
        new.lexeme_id, new.user_id
        using errcode = 'foreign_key_violation';
    end if;
  else
    if not exists (select 1 from public.lexemes lx where lx.id = new.lexeme_id) then
      raise exception 'lexeme_id % is not in the shipped lexicon', new.lexeme_id
        using errcode = 'foreign_key_violation';
    end if;
  end if;
  return new;
end;
$$;

-- Row-level, but the only bulk write path is seedKnownWords (500-row chunks of
-- shipped-lexicon ids, at onboarding only), so the per-row cost is not on any
-- hot path.
create trigger user_words_lexeme_ref
  before insert or update of lexeme_id, user_id on public.user_words
  for each row execute function public.assert_lexeme_ref();

create trigger review_logs_lexeme_ref
  before insert or update of lexeme_id, user_id on public.review_logs
  for each row execute function public.assert_lexeme_ref();
