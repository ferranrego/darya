import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * What a learner got wrong, kept so the app can teach it again.
 *
 * Everything the app currently knows about a learner's mistakes is discarded.
 * `review_logs.rating` is written and read by nothing. `user_exercises` stored
 * one boolean per exercise and could not record a second attempt. Tutor
 * corrections are deleted with the message at 48 hours. So the app cannot do
 * the one thing a teacher does automatically - notice what this person keeps
 * getting wrong - and no amount of tuning the scheduler fixes that, because
 * the evidence was never kept.
 *
 * The row is deliberately small. It carries the token or phrase that was
 * wrong, never a whole message: a tutor correction already reports its issues
 * as {before, after}, and storing those rather than the sentence keeps the
 * teaching signal without extending how long anything a learner wrote is
 * retained. The 48-hour chat purge is untouched.
 */
export type ErrorKind =
  | "srs"
  | "exercise"
  | "grammar"
  | "chat"
  | "interference"
  | "comprehension";

export interface LearnerError {
  kind: ErrorKind;
  /** The word it was about, when it was about a word. */
  lexemeId?: string | null;
  /** The grammar point it was about, when it was about one. */
  grammarPoint?: string | null;
  /** The exercise or lesson item, where there is one. */
  itemId?: string | null;
  /** What the learner produced. */
  given?: string | null;
  /** What was wanted. */
  expected?: string | null;
  /** One sentence of English, when the source produced one. */
  whyEn?: string | null;
}

/** The database row for a mistake. Pure, so it can be tested without a database. */
export function buildErrorRow(userId: string, e: LearnerError) {
  return {
    user_id: userId,
    kind: e.kind,
    lexeme_id: e.lexemeId ?? null,
    grammar_point: e.grammarPoint ?? null,
    item_id: e.itemId ?? null,
    given: e.given ?? null,
    expected: e.expected ?? null,
    why_en: e.whyEn ?? null,
  };
}

/**
 * Record one or more mistakes.
 *
 * Never throws. A learner grading a flashcard must not see an error because
 * the analytics write failed, and losing one row matters far less than
 * interrupting the review - the caller's own write (the FSRS card, the
 * exercise result) has already succeeded by the time this runs.
 */
export async function logErrors(
  db: SupabaseClient,
  userId: string,
  errors: LearnerError[],
): Promise<void> {
  if (errors.length === 0) return;
  try {
    await db.from("learner_errors").insert(errors.map((e) => buildErrorRow(userId, e)));
  } catch {
    // Deliberately swallowed; see above.
  }
}

/**
 * Mark this learner's open mistakes about one word as resolved.
 *
 * Called when they get it right again. Resolving rather than deleting keeps
 * the history: "got this wrong four times before it stuck" is exactly the
 * shape a later report needs, and a deleted row cannot say it.
 */
export async function resolveErrors(
  db: SupabaseClient,
  userId: string,
  lexemeId: string,
): Promise<void> {
  try {
    await db
      .from("learner_errors")
      .update({ resolved_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("lexeme_id", lexemeId)
      .is("resolved_at", null);
  } catch {
    // Deliberately swallowed; see logErrors.
  }
}

/** One word a learner keeps getting wrong, with how often. */
export interface StickingPoint {
  lexemeId: string;
  /** Open mistakes about this word, most-missed first. */
  misses: number;
  /** The most recent one, so a screen can say when. */
  lastAt: string;
}

/** How many open mistakes to read back; far more than any screen or session shows. */
const STICKING_POINT_LIMIT = 200;

/**
 * The words this learner keeps losing, worst first.
 *
 * Counting happens here rather than in SQL because PostgREST cannot group, and
 * a few hundred rows is nothing. Returns `[]` on any failure: every caller uses
 * this to *improve* an ordering it can already produce, so a failed read must
 * degrade to the old behaviour rather than empty a practice session.
 */
export async function stickingPoints(
  db: SupabaseClient,
  userId: string,
): Promise<StickingPoint[]> {
  try {
    const { data, error } = await db
      .from("learner_errors")
      .select("lexeme_id,created_at")
      .eq("user_id", userId)
      .is("resolved_at", null)
      .not("lexeme_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(STICKING_POINT_LIMIT);
    if (error || !data) return [];
    const byId = new Map<string, StickingPoint>();
    for (const row of data as { lexeme_id: string; created_at: string }[]) {
      const seen = byId.get(row.lexeme_id);
      if (seen) seen.misses += 1;
      // Rows arrive newest first, so the first one seen is the latest.
      else byId.set(row.lexeme_id, { lexemeId: row.lexeme_id, misses: 1, lastAt: row.created_at });
    }
    return [...byId.values()].sort((a, b) => b.misses - a.misses || b.lastAt.localeCompare(a.lastAt));
  } catch {
    return [];
  }
}
