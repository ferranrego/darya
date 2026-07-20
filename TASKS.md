# Darya — Build Tracker

> Living task list. Items are checked off **as they are completed**, not before.
> Companion docs: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) · [docs/DESIGN.md](docs/DESIGN.md) · [docs/MIGRATION.md](docs/MIGRATION.md) · [docs/CONTENT-SCHEMA.md](docs/CONTENT-SCHEMA.md)

## Phase 0 — Foundation

- [x] Git init, Next.js 16 + TypeScript strict + Tailwind v4 scaffold (pnpm)
- [x] Core deps: ts-fsrs, zod, @tanstack/react-query, zustand, motion, supabase-js/ssr, vitest
- [x] TASKS.md + docs: ARCHITECTURE, DESIGN, MIGRATION, CONTENT-SCHEMA
- [x] Zod content schemas (`src/lib/content/schema.ts`) + JSON Schema export script
- [x] Fonts: Vazirmatn (variable) + Inter, self-hosted, RTL base styles
- [x] Design tokens: palette, type scale, spacing, motion durations (globals.css)
- [x] Seed lexicon `content/lexicon/lexicon.json` (core set now; Gemini batch-expand once API key present)
- [x] Dari override + curation notes (`content/lexicon/README.md`)
- [x] Alphabet course content `content/alphabet/course.json` (all 32 letters, ordered units, exercises)
- [x] Level definitions `content/levels/levels.json`
- [x] Seed texts `content/texts/seed/` (hand-authored, per level)
- [x] Content validation script `scripts/validate-content.ts` (+ `pnpm validate:content`)
- [x] Unit tests: tokenizer/ZWNJ normalization, schema round-trip

## Phase 0b — Backend

- [x] Supabase project created + linked via CLI
- [x] Migration: full schema (profiles, lexemes, user_words, review_logs, texts, user_texts, alphabet_progress, push_subscriptions, daily_activity) with RLS
- [x] Seed script `scripts/seed.ts` (content JSON → DB)
- [x] Typed repository layer `src/lib/db/`
- [x] `.env.local` wiring (Supabase keys auto; **GEMINI_API_KEY needed from user**)

## Phase 1 — Complete usable product

### Auth & onboarding
- [x] Email/password auth (login/signup), session middleware, profile bootstrap
- [x] Welcome screen
- [x] Script check ("Can you read this?")
- [x] Level assessment: word-cloud tap UI across frequency bands
- [x] Vocab-size estimation + known-word seeding + starting level
- [x] Non-reader route → alphabet course entry

### Alphabet course
- [x] Course map (units, progress)
- [x] Letter-forms component (isolated/initial/medial/final)
- [x] Exercises: recognizeLetter, pickForm, matchSound, readWord, readSentence
- [x] Progress persistence + unlock logic

### Reading
- [x] Token renderer (RTL, tap targets, state tints: new/learning/known)
- [x] Word popover (gloss, translit, add-to-learning)
- [x] Text view with sentence translation reveal
- [x] Home: continue reading / next text / daily goal ring
- [x] Generation route: Gemini Flash → Groq → OpenRouter fallback, Zod-validated JSON, vocab-constraint verifier, Postgres cache
- [x] Adaptive next-text logic (new-word ratio tunable per user)
- [x] Pre-generation queue (3–5 texts ahead)

### SRS
- [x] ts-fsrs scheduler integration (server-persisted cards)
- [x] Review UI: two buttons (Forgot → Again, Got it → Good), reveal flow
- [x] learning → known transition (threshold + micro-celebration)
- [x] Daily review queue + cap

### Gamification
- [x] XP model (reading, reviews, alphabet)
- [x] Streaks (current/best, any-activity day)
- [x] Daily goal + progress ring
- [x] Minimal stats (known words, words read)

### PWA & ship
- [x] manifest.webmanifest + icons + install prompt
- [x] Service worker: shell precache, font/lexicon runtime cache, offline current-texts + due reviews
- [x] Polish pass: typography, spacing, motion audit, reduced-motion, RTL audit
- [x] E2E browser walkthrough (375px + desktop): onboarding both branches, read 3 texts, tap words, review session, streak, offline reload
- [x] Deploy to Vercel + production PWA install check

## Phase 2 — Audio & depth
- [ ] Word/sentence audio (pick best free TTS; pre-generated files as content if quality wins)
- [ ] Richer stats page
- [ ] Reading-font toggle (Scheherazade New)
- [ ] FSRS parameters view

## Phase 3 — Social & notifications
- [ ] Web push: VAPID, subscribe flow, Declarative Web Push payloads (iOS ≥18.4)
- [ ] Vercel cron: streak-reminder push
- [ ] Leaderboard (weekly XP + known words)
- [ ] Text library / reading history

## Blocked on user
- [ ] `GEMINI_API_KEY` in `.env.local` — get free key at https://aistudio.google.com/apikey (no card, cannot incur costs)
