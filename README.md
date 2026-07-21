# Darya — Learn Dari by reading

A comprehensible-input Dari (Afghan Persian, Kabul standard) learning PWA for a
small circle of learners. Adaptive AI-generated texts at ~2–10% new vocabulary,
tap-to-learn word lookup, FSRS spaced repetition with a two-button review, an
alphabet course for non-readers, and light gamification — on 100% free
infrastructure.

**Live:** https://darya-delta.vercel.app

## Stack

Next.js 16 · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + RLS) ·
`ts-fsrs` · Groq (→ OpenRouter fallback) · Vercel · PWA.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DESIGN.md](docs/DESIGN.md),
[docs/MIGRATION.md](docs/MIGRATION.md), [docs/CONTENT-SCHEMA.md](docs/CONTENT-SCHEMA.md).

Progress and the phased plan live in [TASKS.md](TASKS.md).

## Local development

```bash
pnpm install
cp .env.example .env.local        # fill in the values below
pnpm dev                          # http://localhost:3000
```

`.env.local` needs:

| Variable | Where |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key |
| `SUPABASE_SECRET_KEY` | Supabase secret key (server only) |
| `GROQ_API_KEY` | https://console.groq.com — free tier, primary AI provider |
| `OPENROUTER_API_KEY` | https://openrouter.ai — free-tier fallback |

Without an AI key the app still runs on the bundled seed texts; new texts are
generated only once a learner exhausts the seed pool for their level.

## Content pipeline

Content is open, versioned JSON in [`content/`](content/) validated by Zod
schemas. Regenerate and check it with:

```bash
pnpm build:lexicon        # scripts/data/*.txt → content/lexicon/lexicon.json
pnpm build:texts          # seed sources → content/texts/seed/*.json
pnpm export:schemas       # Zod → content/schema/*.schema.json
pnpm validate:content     # schema + cross-file integrity checks
pnpm seed                 # push lexicon + seed texts to Supabase
pnpm test                 # vitest (tokenizer, normalization)
```

## Database

Schema and RLS live in [`supabase/migrations/`](supabase/migrations/). Apply with
`supabase db push` (or `psql` against the connection string).
