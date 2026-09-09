# Architecture

Darya is a Dari (Afghan Persian) learning PWA built on comprehensible input: adaptive
AI-generated texts, tap-to-reveal vocabulary, FSRS spaced repetition, and an alphabet
course - for a small circle of users on 100% free infrastructure.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, TypeScript strict), Tailwind CSS v4, motion |
| State | TanStack Query (server state) + Zustand (ephemeral UI state) |
| Data | Supabase (Postgres + Auth + RLS), SQL migrations in `supabase/migrations/` |
| SRS | `ts-fsrs` (FSRS algorithm; we never hand-roll scheduling) |
| AI | Groq (primary, free tier) → OpenRouter (free-tier fallback) |
| PWA | Hand-written service worker (`public/sw.js`) + web manifest |
| Push | Web Push API (VAPID) with Declarative Web Push payloads for iOS ≥ 18.4 |

## Directory layout

```
content/            ← open, versioned content (source of truth, see CONTENT-SCHEMA.md)
  lexicon/          ← lexicon.json + curation README
  alphabet/         ← course.json
  levels/           ← levels.json
  texts/seed/       ← hand-authored seed texts (TextDocument format)
  schema/           ← exported JSON Schemas (generated, committed)
docs/               ← this documentation (PEDAGOGY.md = what may be taught)
scripts/            ← seed, validate-content, export-schemas, lexicon build
supabase/           ← config + SQL migrations
src/
  app/              ← routes (App Router). Route groups: (auth), (app)
  components/       ← UI components; components/ui = primitives
  lib/
    content/        ← Zod schemas + typed loaders for content/
    db/             ← typed repository layer (ALL data access goes through here)
    srs/            ← ts-fsrs mapping (two-button grades, card ↔ row)
    ai/             ← provider chain, prompts, generation + verification
    text/           ← tokenizer, ZWNJ normalization, level estimation
public/             ← manifest, sw.js, icons, self-hosted fonts
```

See `docs/PEDAGOGY.md` for the rules that decide what a learner is taught, and
`CLAUDE.md` for the ones that have caused incidents.

## Key invariants

1. **Content is data, not code.** Everything learnable lives in `content/*.json`,
   validated by Zod schemas in `src/lib/content/schema.ts`. The DB only mirrors it
   (via `scripts/seed.ts`); the app never depends on data that exists only in the DB.
2. **One data-access layer.** UI and routes call `src/lib/db/` repositories, never the
   Supabase client directly. Swapping Postgres providers means touching one directory.
3. **One AI entry point.** `src/lib/ai/generate.ts` exposes the provider-agnostic
   generation function; providers are config, not call sites. Generated texts are
   cached in Postgres keyed by (level, vocab-hash) and shared across users.
4. **FSRS state is authoritative in `user_words`.** `review_logs` is append-only and
   sufficient to re-derive/optimize parameters later.
5. **Strong typing end to end.** DB row types, content types, and API payloads are all
   derived from Zod schemas or generated Supabase types - no `any`.
6. **The shipped lexicon always wins.** Imported articles add a per-user dictionary
   (`user_lexemes`, ids `ux-…`, glossed on demand by `/api/import/gloss`). It is a
   second index consulted only *after* `lexiconIndex()`, everywhere, so a model's
   guess at a lemma can never shadow reviewed content. Personal entries never enter
   `content/lexicon.json` or the `lexemes` mirror - the mirror is readable by every
   authenticated user, so writing there would both leak one learner's vocabulary to
   all of them and put unreviewed model output into the shared dictionary.
7. **Imports are not in `texts`.** `public.texts` feeds the pool every learner reads
   from. Imports live in `imported_texts`, owner-only, with their own `read_at` -
   `user_texts.text_id` is a foreign key to `texts`, which an import has no row in.
   `textDocumentSchema` rejects `source: "imported"` outright, and a test asserts it.

### The lexeme reference

`user_words.lexeme_id` and `review_logs.lexeme_id` were foreign keys to
`public.lexemes`. They cannot be, now that a personal word resolves through
`user_lexemes` instead - but dropping the constraint outright would give up exactly
the guarantee CLAUDE.md #4 names. The `20260909000001` migration replaces each FK
with a CHECK on the id shape plus a trigger that resolves it to the right table, and
additionally requires a `ux-` row to belong to the *same* user - an ownership rule no
foreign key could express. A trigger only guards new writes, so `validate-db.ts`
sweeps for rows orphaned by a later content edit, which is the incident the original
rule was written about.

## Free-tier budget

- Groq free tier: ~30 RPM / generous daily quota, no billing required
  cost). One text ≈ 1 request; caching + pre-generation keeps 3–5 users at
  a few dozen requests/day worst case.
- Supabase free: 500 MB DB - lexicon + thousands of cached texts ≈ a few MB.
- Vercel Hobby: static-heavy PWA, tiny serverless usage; daily cron for push.
