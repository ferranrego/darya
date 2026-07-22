import type { SupabaseClient } from "@supabase/supabase-js";
import type { ActivityDelta } from "./db/activity";
import type { ProfileRow } from "./db/types";

/** XP awards: the only place point values live. */
export const XP = {
  textRead: 10,
  review: 2,
  wordLearned: 5,
  alphabetUnit: 15,
  grammarLesson: 15,
} as const;

/**
 * Record activity via the record_activity RPC: one atomic call that bumps
 * today's daily_activity row, adds XP, and maintains the streak. The day
 * boundary (Barcelona midnight) is computed server-side, so device clocks
 * can never write into the wrong day.
 */
export async function recordActivity(
  db: SupabaseClient,
  _userId: string,
  delta: ActivityDelta,
): Promise<ProfileRow> {
  const { data, error } = await db.rpc("record_activity", {
    xp_delta: delta.xp ?? 0,
    reviews: delta.reviews_done ?? 0,
    texts: delta.texts_read ?? 0,
    words: delta.words_learned ?? 0,
  });
  if (error) throw error;
  return data as ProfileRow;
}
