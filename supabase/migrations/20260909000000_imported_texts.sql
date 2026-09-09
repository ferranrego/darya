-- ---------------------------------------------------------------------------
-- Article import: per-user reading material and a per-user dictionary.
--
-- Imports deliberately do NOT live in public.texts. That table's rows feed the
-- pool every learner reads from (getTextsForLevel -> selectUnread), its `source`
-- is a CHECK of ('seed','generated'), it has no INSERT policy at all, and
-- user_texts.text_id is an FK to it. One missed filter there would put one
-- learner's article into everybody's queue, silently. A separate owner-only
-- table removes that class of bug entirely, at the cost of its own read_at /
-- words_tapped columns instead of a user_texts row.
-- ---------------------------------------------------------------------------

create table public.imported_texts (
  id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Null for text the learner pasted rather than fetched.
  source_url text,
  title_en text,
  doc jsonb not null,
  -- Progress lives on the row: user_texts.text_id is an FK to public.texts and
  -- an import has no row there.
  read_at timestamptz,
  words_tapped integer not null default 0,
  -- 'readability' | 'fallback' | 'paste'. Recorded so that a site redesign
  -- silently pushing every import onto the crude fallback shows up in data
  -- rather than in a bug report.
  extractor text,
  truncated boolean not null default false,
  -- The build is single-language, but stamping it makes a wrong-language
  -- import diagnosable instead of merely puzzling.
  lang text not null,
  char_count integer not null default 0,
  sentence_count integer not null default 0,
  -- Share of running words the learner did not know at import time. Shown as a
  -- readability estimate, never used as a gate: the learner chose the article.
  new_word_ratio real,
  created_at timestamptz not null default now()
);

create index imported_texts_user_idx on public.imported_texts (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Personal dictionary.
--
-- A real article is mostly outside the shipped lexicon. Those words are glossed
-- on demand and stored HERE, per learner, never in public.lexemes - which is a
-- seed mirror of content/lexicon.json readable by every authenticated user, so
-- writing to it would both leak one learner's vocabulary to all of them and put
-- unreviewed model output into the shared dictionary (CLAUDE.md: "a wrong entry
-- is worse than a missing one").
--
-- The column set mirrors LexiconEntry on purpose: profile.text.buildIndex takes
-- a plain LexiconEntry[], so these rows get the full morphology engine - a
-- personal Catalan verb resolves its whole conjugation, a personal Dari noun its
-- plural - without any code that knows they are personal.
-- ---------------------------------------------------------------------------

create table public.user_lexemes (
  id text primary key check (id ~ '^ux-[0-9a-f]{8,}$'),
  user_id uuid not null references public.profiles (id) on delete cascade,
  target text not null,
  target_normalized text not null,
  translit text,
  gloss_en text not null,
  pos text not null,
  -- Dari verbs conjugate only when a present stem is known (see
  -- src/lib/lang/prs/lexicon-index.ts); without it the index generates past
  -- forms only.
  present_stem text,
  variants jsonb not null default '[]',
  example_target text,
  example_translit text,
  example_en text,
  -- Where it was first met, for the review card's context line.
  source_text_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One entry per headword per learner: re-tapping another inflection of the
  -- same word must widen `variants`, not mint a second id.
  unique (user_id, target_normalized)
);

create index user_lexemes_user_idx on public.user_lexemes (user_id);

alter table public.imported_texts enable row level security;
alter table public.user_lexemes enable row level security;

create policy "imported_texts owner" on public.imported_texts
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Deliberately three narrow policies rather than the `for all` used elsewhere:
-- there is no delete policy. user_words.lexeme_id points at these rows, so
-- deleting one orphans real SRS progress - the same rule CLAUDE.md #4 states for
-- the shipped lexicon, here enforced by RLS instead of by a comment. Repair in
-- place with an update.
create policy "user_lexemes owner select" on public.user_lexemes
  for select to authenticated using (user_id = auth.uid());
create policy "user_lexemes owner insert" on public.user_lexemes
  for insert to authenticated with check (user_id = auth.uid());
create policy "user_lexemes owner update" on public.user_lexemes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Lazy sentence translation writes one sentence at a time. A read-modify-write
-- of the whole `doc` from two sentences expanded in quick succession loses one
-- of them, so patch in place instead.
-- ---------------------------------------------------------------------------

create function public.set_imported_sentence(
  p_id text,
  p_index integer,
  p_en text,
  p_translit text default null
) returns void
language plpgsql
security invoker
as $$
declare
  patched jsonb;
begin
  select jsonb_set(doc, array['sentences', p_index::text, 'en'], to_jsonb(p_en), false)
    into patched
    from public.imported_texts
   where id = p_id and user_id = auth.uid()
     and doc -> 'sentences' -> p_index is not null;

  if patched is null then
    return;
  end if;

  -- A Latin-script build has no transliteration. Writing JSON null would fail
  -- the document schema, whose `translit` is optional, not nullable.
  if p_translit is not null and p_translit <> '' then
    patched := jsonb_set(patched, array['sentences', p_index::text, 'translit'],
                         to_jsonb(p_translit), false);
  end if;

  update public.imported_texts set doc = patched
   where id = p_id and user_id = auth.uid();
end;
$$;
