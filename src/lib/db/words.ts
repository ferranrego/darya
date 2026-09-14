import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, ReviewLog } from "ts-fsrs";
import type { UserWordRow, WordStatus } from "./types";
import { newCard } from "../srs/scheduler";

export async function getUserWords(db: SupabaseClient, userId: string): Promise<UserWordRow[]> {
  const { data, error } = await db.from("user_words").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as UserWordRow[];
}

export interface WordCounts {
  /** Known words from the shipped lexicon only - same rule as `curricularKnownCount`. */
  known: number;
  /** Every word in review, personal ones included. */
  learning: number;
  /** Learning words whose card is due at `now`. */
  due: number;
}

/**
 * The three numbers the app shell and Home show, without the rows.
 *
 * The Review badge and the milestone observer are mounted on every page, and
 * both used to download the learner's whole `user_words` table - every row,
 * with its FSRS card - to count it in the browser. A near-native placement
 * seeds thousands of rows, so every tab switch paid for all of them. Three
 * head-only counts return integers, served by `user_words_due_idx
 * (user_id, status, due)`.
 *
 * `known` excludes `ux-` ids in SQL for the reason `curricularKnownCount`
 * gives: level thresholds count the shipped lexicon, and an imported article's
 * vocabulary is not on that path.
 */
export async function getWordCounts(
  db: SupabaseClient,
  userId: string,
  now: Date,
): Promise<WordCounts> {
  const head = { count: "exact" as const, head: true };
  const [known, learning, due] = await Promise.all([
    db
      .from("user_words")
      .select("lexeme_id", head)
      .eq("user_id", userId)
      .eq("status", "known")
      .not("lexeme_id", "like", "ux-%"),
    db.from("user_words").select("lexeme_id", head).eq("user_id", userId).eq("status", "learning"),
    db
      .from("user_words")
      .select("lexeme_id", head)
      .eq("user_id", userId)
      .eq("status", "learning")
      .lte("due", now.toISOString()),
  ]);
  for (const r of [known, learning, due]) if (r.error) throw r.error;
  return { known: known.count ?? 0, learning: learning.count ?? 0, due: due.count ?? 0 };
}

export async function getDueWords(
  db: SupabaseClient,
  userId: string,
  now: Date,
  limit: number,
): Promise<UserWordRow[]> {
  const { data, error } = await db
    .from("user_words")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "learning")
    .lte("due", now.toISOString())
    .order("due", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as UserWordRow[];
}

/** Insert or update one word's SRS state. */
export async function upsertUserWord(
  db: SupabaseClient,
  row: {
    user_id: string;
    lexeme_id: string;
    status: WordStatus;
    due: string | null;
    fsrs: Card | null;
    context_target?: string | null;
    context_translit?: string | null;
    context_en?: string | null;
    produced_at?: string | null;
    produced_count?: number;
  },
): Promise<void> {
  const { error } = await db.from("user_words").upsert(row);
  if (error) throw error;
}

/**
 * Record that the learner wrote this word correctly.
 *
 * Separate from `upsertUserWord` because it must not be able to overwrite the
 * FSRS card: production and scheduling are different facts about a word, and a
 * single upsert carrying a stale card would silently reschedule the review.
 * The count is incremented server-side-ish - read then write - because two
 * concurrent reviews of the same word are not a thing a single learner does.
 */
export async function recordProduction(
  db: SupabaseClient,
  userId: string,
  lexemeId: string,
  previousCount: number,
): Promise<void> {
  const patch: Record<string, unknown> = { produced_count: previousCount + 1 };
  // First production only: `produced_at` answers "when did this stop being
  // self-report", and overwriting it every time would lose that.
  if (previousCount === 0) patch.produced_at = new Date().toISOString();
  const { error } = await db
    .from("user_words")
    .update(patch)
    .eq("user_id", userId)
    .eq("lexeme_id", lexemeId);
  if (error) throw error;
}

/** Bulk-seed words as already known (onboarding assessment). */
export async function seedKnownWords(
  db: SupabaseClient,
  userId: string,
  lexemeIds: string[],
): Promise<void> {
  if (lexemeIds.length === 0) return;
  const rows = lexemeIds.map((lexeme_id) => ({
    user_id: userId,
    lexeme_id,
    status: "known" as const,
    due: null,
    fsrs: null,
  }));
  // A near-native assessment can seed the whole lexicon; chunk the upsert to
  // keep each request payload comfortably under PostgREST limits.
  //
  // `ignoreDuplicates`: these rows carry `fsrs: null`, so overwriting an
  // existing row would erase that word's entire review history. That could not
  // happen while the placement ran exactly once per account; it is the first
  // thing that happens the moment a retake exists. A retake re-estimates the
  // level - it never resets progress.
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db
      .from("user_words")
      .upsert(rows.slice(i, i + CHUNK), { ignoreDuplicates: true });
    if (error) throw error;
  }
}

/**
 * Seed words into the review system rather than crediting them outright.
 *
 * The topmost frequency band a learner cleared at placement. They very likely
 * do know these - but "very likely" is exactly what the old rule claimed about
 * the ~500 words it invented per advanced sign-up, and those words never
 * entered review while still counting toward promotion. These get a real
 * starting card, so the first thing the app does is check.
 *
 * `ignoreDuplicates`: a retake must never reset a card the learner has
 * actually been reviewing. Nothing here may overwrite existing progress.
 */
export async function seedLearningWords(
  db: SupabaseClient,
  userId: string,
  lexemeIds: string[],
): Promise<void> {
  if (lexemeIds.length === 0) return;
  const now = new Date();
  const rows = lexemeIds.map((lexeme_id) => ({
    user_id: userId,
    lexeme_id,
    status: "learning" as const,
    due: now.toISOString(),
    fsrs: newCard(now),
  }));
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await db
      .from("user_words")
      .upsert(rows.slice(i, i + CHUNK), { ignoreDuplicates: true });
    if (error) throw error;
  }
}

export async function logReview(
  db: SupabaseClient,
  userId: string,
  lexemeId: string,
  rating: number,
  log: ReviewLog,
): Promise<void> {
  const { error } = await db.from("review_logs").insert({
    user_id: userId,
    lexeme_id: lexemeId,
    rating,
    log,
  });
  if (error) throw error;
}
