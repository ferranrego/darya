import type { SupabaseClient } from "@supabase/supabase-js";

import type { PromotionEvidence } from "../content/promotion";

/**
 * What a learner has actually demonstrated, for the promotion rule to read.
 *
 * Until now promotion counted only words marked "known" - never accuracy,
 * never retention, never comprehension. All three of these facts existed
 * nowhere to be read: `review_logs.rating` was written and never read,
 * comprehension was not checked at all, and `user_exercises` could not record
 * a second attempt. They can be read now, and this is where.
 */

/** Reviews to look back over. Recent enough to be current, long enough to be a measurement. */
const REVIEW_WINDOW = 300;

/**
 * Read retention and comprehension for one learner.
 *
 * Returns `undefined` on any failure, which the promotion rule treats as
 * "absent evidence" and therefore never blocking. A learner who finished a
 * text must not be denied a level they earned because an analytics read timed
 * out - the failure has to fall on the side of the learner.
 */
export async function promotionEvidence(
  db: SupabaseClient,
  userId: string,
): Promise<PromotionEvidence | undefined> {
  try {
    const [{ data: reviews }, { data: texts }] = await Promise.all([
      db
        .from("review_logs")
        .select("rating")
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .limit(REVIEW_WINDOW),
      db
        .from("user_texts")
        .select("comprehension_correct,comprehension_total")
        .eq("user_id", userId)
        .not("comprehension_total", "is", null),
    ]);

    const reviewRows = (reviews ?? []) as { rating: number }[];
    // FSRS ratings are 1-4 and the review screen writes only Again (1) or Good
    // (3); anything above Again is a remembered card. Comparing against the
    // numeric floor rather than importing the enum keeps this readable against
    // rows written by an older client.
    const remembered = reviewRows.filter((r) => r.rating > 1).length;

    const textRows = (texts ?? []) as {
      comprehension_correct: number | null;
      comprehension_total: number | null;
    }[];
    let correct = 0;
    let asked = 0;
    for (const t of textRows) {
      correct += t.comprehension_correct ?? 0;
      asked += t.comprehension_total ?? 0;
    }

    return {
      reviews: reviewRows.length,
      retention: reviewRows.length === 0 ? 0 : remembered / reviewRows.length,
      checks: asked,
      comprehension: asked === 0 ? 0 : correct / asked,
    };
  } catch {
    return undefined;
  }
}
