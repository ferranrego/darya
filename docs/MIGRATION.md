# Migration Path

The stack is chosen so nothing is trapped. If/when the app outgrows free tiers:

## Database (Supabase → any Postgres)

- Schema lives in `supabase/migrations/*.sql` (plain SQL, no Supabase-only features
  beyond `auth.uid()` in RLS policies, which are marked with comments).
- Move: `pg_dump` → restore on Neon/Fly/RDS/self-hosted; re-run RLS or enforce
  authorization in the app layer.
- All app data access goes through `src/lib/db/` repositories - swap the Supabase
  client for postgres.js/Drizzle behind the same interfaces.

## Auth (Supabase Auth → anything)

- Email/password only; users exportable via Supabase admin API (email + bcrypt hash).
- Import into Auth.js/Better-Auth/Clerk or keep plain Postgres + your own session
  layer. `profiles.id` is the stable user key everywhere; only the auth provider
  changes.

## Content

- Source of truth is `content/*.json` in git, with published JSON Schemas
  (`content/schema/`). Any future system re-seeds from these files. No export needed -
  it was never locked in.

## AI providers

- One entry point (`src/lib/ai/generate.ts`) with an ordered provider chain
  (Gemini → Groq → OpenRouter) configured by env vars. Adding/removing a provider
  is config + one adapter file. Cached texts in Postgres keep working with zero
  providers configured.

## Hosting (Vercel → anywhere)

- Standard Next.js: `next build` runs on Cloudflare (OpenNext), Netlify, or a
  Node/Docker host. Vercel-specific surface is limited to `vercel.json`
  (cron definition) - replace with any scheduler hitting the same route.

## Push

- Standard Web Push (VAPID) - subscriptions are provider-independent and stored in
  our own `push_subscriptions` table. Nothing to migrate, ever.
