# Architecture

Darya is a Dari (Afghan Persian) learning PWA built on comprehensible input: adaptive
AI-generated texts, tap-to-reveal vocabulary, FSRS spaced repetition, and an alphabet
course — for a small circle of users on 100% free infrastructure.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js 16 (App Router, TypeScript strict), Tailwind CSS v4, motion |
| State | TanStack Query (server state) + Zustand (ephemeral UI state) |
| Data | Supabase (Postgres + Auth + RLS), SQL migrations in `supabase/migrations/` |
| SRS | `ts-fsrs` (FSRS algorithm; we never hand-roll scheduling) |
| AI | Gemini Flash free tier → Groq → OpenRouter `:free` fallback chain |
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
docs/               ← this documentation
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
   derived from Zod schemas or generated Supabase types — no `any`.

## Free-tier budget

- Gemini Flash free tier: ~10 RPM / 1,500 req-day, no billing attached (cannot incur
  cost). One text ≈ 1 request; caching + pre-generation keeps 3–5 users at
  a few dozen requests/day worst case.
- Supabase free: 500 MB DB — lexicon + thousands of cached texts ≈ a few MB.
- Vercel Hobby: static-heavy PWA, tiny serverless usage; daily cron for push.
