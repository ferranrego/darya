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

- [ ] Supabase project created + linked via CLI
- [ ] Migration: full schema (profiles, lexemes, user_words, review_logs, texts, user_texts, alphabet_progress, push_subscriptions, daily_activity) with RLS
- [ ] Seed script `scripts/seed.ts` (content JSON → DB)
- [ ] Typed repository layer `src/lib/db/`
- [ ] `.env.local` wiring (Supabase keys auto; **GEMINI_API_KEY needed from user**)

## Phase 1 — Complete usable product

### Auth & onboarding
- [ ] Email/password auth (login/signup), session middleware, profile bootstrap
- [ ] Welcome screen
- [ ] Script check ("Can you read this?")
- [ ] Level assessment: word-cloud tap UI across frequency bands
- [ ] Vocab-size estimation + known-word seeding + starting level
- [ ] Non-reader route → alphabet course entry

### Alphabet course
- [ ] Course map (units, progress)
- [ ] Letter-forms component (isolated/initial/medial/final)
- [ ] Exercises: recognizeLetter, pickForm, matchSound, readWord, readSentence
- [ ] Progress persistence + unlock logic

### Reading
- [ ] Token renderer (RTL, tap targets, state tints: new/learning/known)
- [ ] Word popover (gloss, translit, add-to-learning)
- [ ] Text view with sentence translation reveal
- [ ] Home: continue reading / next text / daily goal ring
- [ ] Generation route: Gemini Flash → Groq → OpenRouter fallback, Zod-validated JSON, vocab-constraint verifier, Postgres cache
- [ ] Adaptive next-text logic (new-word ratio tunable per user)
- [ ] Pre-generation queue (3–5 texts ahead)

### SRS
- [ ] ts-fsrs scheduler integration (server-persisted cards)
- [ ] Review UI: two buttons (Forgot → Again, Got it → Good), reveal flow
- [ ] learning → known transition (threshold + micro-celebration)
- [ ] Daily review queue + cap

### Gamification
- [ ] XP model (reading, reviews, alphabet)
- [ ] Streaks (current/best, any-activity day)
- [ ] Daily goal + progress ring
- [ ] Minimal stats (known words, words read)

### PWA & ship
- [ ] manifest.webmanifest + icons + install prompt
- [ ] Service worker: shell precache, font/lexicon runtime cache, offline current-texts + due reviews
- [ ] Polish pass: typography, spacing, motion audit, reduced-motion, RTL audit
- [ ] E2E browser walkthrough (375px + desktop): onboarding both branches, read 3 texts, tap words, review session, streak, offline reload
- [ ] Deploy to Vercel + production PWA install check

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
