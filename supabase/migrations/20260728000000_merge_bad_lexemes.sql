-- ---------------------------------------------------------------------------
-- Merge and remove three bad lexicon entries.
--
--   lx-0286  می‌کنم   a pure inflected form of کردن entered as its own headword.
--                     Because headwords outrank generated conjugations in
--                     lexicon-index, tapping می‌کنم showed "I do (present)"
--                     instead of کردن "to do" - while می‌کند correctly showed
--                     کردن. Merge into lx-0097 (کردن).
--   lx-5234  انکار کردن  an exact duplicate of lx-0928 (same verb, freqRank 928).
--                     It was written solid (انکارکردن), which hid the clash.
--                     Merge into lx-0928.
--   lx-0760  گډول    Pashto, not Dari (ډ is a Pashto-only letter). No Dari
--                     equivalent to merge into - drop the user rows.
--
-- user_words.lexeme_id and review_logs.lexeme_id are FKs to lexemes(id) with
-- NO on-delete action, so the rows must be dealt with before the lexemes go.
-- scripts/seed.ts only upserts and never deletes, so this cannot be left to a
-- reseed.
--
-- user_words is keyed (user_id, lexeme_id): a straight UPDATE would violate the
-- primary key for anyone holding both the source and the target. Those users
-- keep their existing target card - it carries their real review history - and
-- the redundant source row is dropped.
-- ---------------------------------------------------------------------------

create temporary table lexeme_merges (source text primary key, target text) on commit drop;
insert into lexeme_merges (source, target) values
  ('lx-0286', 'lx-0097'),  -- می‌کنم  → کردن
  ('lx-5234', 'lx-0928'),  -- انکار کردن duplicate → canonical
  ('lx-0760', null);       -- گډول (Pashto) → no target, discard

-- 1. Re-point user_words where the user does not already hold the target.
update public.user_words u
set lexeme_id = m.target
from lexeme_merges m
where u.lexeme_id = m.source
  and m.target is not null
  and not exists (
    select 1 from public.user_words t
    where t.user_id = u.user_id and t.lexeme_id = m.target
  );

-- 2. Drop what remains (duplicate holdings, and the un-mergeable Pashto entry).
delete from public.user_words u
using lexeme_merges m
where u.lexeme_id = m.source;

-- 3. review_logs has no per-lexeme uniqueness, so it can be re-pointed wholesale.
update public.review_logs r
set lexeme_id = m.target
from lexeme_merges m
where r.lexeme_id = m.source and m.target is not null;

delete from public.review_logs r
using lexeme_merges m
where r.lexeme_id = m.source;

-- 4. Cached context sentences were generated for the wrong headword; drop them
--    so they are regenerated against the canonical entry. (No FK here.)
delete from public.lexeme_context_sentences c
using lexeme_merges m
where c.lexeme_id = m.source;

-- 5. Finally the lexemes themselves. seed.ts will not re-create them: they are
--    removed from content/lexicon/lexicon.json in the same change.
delete from public.lexemes l
using lexeme_merges m
where l.id = m.source;
