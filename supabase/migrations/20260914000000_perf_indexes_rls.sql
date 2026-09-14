-- Performance: indexes for queries that sort without one, and RLS policies
-- that evaluate auth.uid() once per statement instead of once per row.
--
-- Written against the code as of this migration. Port 1:1 to Riera, then
-- `npx supabase db push && pnpm validate:db` on both (CLAUDE.md: migrations
-- must not drift).

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

-- Leaderboard: `profiles.order("xp", desc).limit(100)` sorted every profile in
-- memory on each view; the table had only its primary key.
create index if not exists profiles_xp_idx on public.profiles (xp desc);

-- Reading History, Profile's history and the re-read list all order a
-- learner's `user_texts` by read_at. The primary key is (user_id, text_id),
-- so that sort ran over every row the learner has.
create index if not exists user_texts_user_read_idx on public.user_texts (user_id, read_at desc);

-- promotionEvidence (src/lib/db/evidence.ts) takes a learner's latest 300
-- review logs ordered by id. The existing review_logs_user_idx is on
-- (user_id, reviewed_at), which cannot serve that order.
create index if not exists review_logs_user_id_idx on public.review_logs (user_id, id desc);

-- The daily reminder cron reads opted-in profiles not active today. Partial,
-- because only opted-in rows are ever read.
create index if not exists profiles_reminder_idx
  on public.profiles (last_active_date)
  where reminder_notifications;

-- ---------------------------------------------------------------------------
-- RLS: (select auth.uid()) instead of auth.uid()
-- ---------------------------------------------------------------------------
--
-- A bare auth.uid() in a policy is re-evaluated for every row the policy
-- filters. Wrapped in a scalar subquery Postgres evaluates it once per
-- statement (an initPlan) - Supabase's documented fix, flagged by its
-- `auth_rls_initplan` advisor. The predicates are otherwise copied verbatim
-- from the migrations that created them; ALTER POLICY cannot change a
-- policy's command or roles, so those stay exactly as they were.

-- 20260720000000_init.sql
alter policy "profiles self-update" on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "user_words owner" on public.user_words
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "review_logs owner" on public.review_logs
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "user_texts owner" on public.user_texts
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "alphabet_progress owner" on public.alphabet_progress
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "push_subscriptions owner" on public.push_subscriptions
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "daily_activity owner" on public.daily_activity
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 20260720000001_alphabet_srs.sql
alter policy "Users can read their own letters" on public.user_letters
  using ((select auth.uid()) = user_id);
alter policy "Users can insert their own letters" on public.user_letters
  with check ((select auth.uid()) = user_id);
alter policy "Users can update their own letters" on public.user_letters
  using ((select auth.uid()) = user_id);

-- 20260722000000_chat.sql, 20260722000003_chat_delete.sql
alter policy "chat_messages insert own" on public.chat_messages
  with check (user_id = (select auth.uid()));
alter policy "chat_messages delete own" on public.chat_messages
  using (user_id = (select auth.uid()));

-- 20260723000000_grammar.sql, 20260723000001_exercises.sql
alter policy "grammar_progress owner" on public.grammar_progress
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "user_exercises owner" on public.user_exercises
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 20260811000000_tutor_messages.sql - the 48-hour window is part of the rule.
alter policy "tutor_messages readable (own, 48h)" on public.tutor_messages
  using (
    user_id = (select auth.uid())
    and created_at >= now() - interval '48 hours'
  );

-- 20260909000000_imported_texts.sql
alter policy "imported_texts owner" on public.imported_texts
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
alter policy "user_lexemes owner select" on public.user_lexemes
  using (user_id = (select auth.uid()));
alter policy "user_lexemes owner insert" on public.user_lexemes
  with check (user_id = (select auth.uid()));
alter policy "user_lexemes owner update" on public.user_lexemes
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 20260911000000_learner_errors.sql
alter policy "learner_errors are private" on public.learner_errors
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 20260911040000_grammar_review.sql
alter policy "grammar_cards owner" on public.grammar_cards
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
