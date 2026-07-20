import type { SupabaseClient } from "@supabase/supabase-js";
import { bumpDailyActivity, localDate, type ActivityDelta } from "./db/activity";
import { getProfile, updateProfile } from "./db/profiles";
import type { ProfileRow } from "./db/types";

/** XP awards: the only place point values live. */
export const XP = {
  textRead: 10,
  review: 2,
  wordLearned: 5,
  alphabetUnit: 15,
} as const;

function yesterdayOf(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return localDate(d);
}

/**
 * Record activity: bumps today's daily_activity row, adds XP to the profile,
 * and maintains the streak (any-activity day counts).
 */
export async function recordActivity(
  db: SupabaseClient,
  userId: string,
  delta: ActivityDelta,
): Promise<ProfileRow> {
  await bumpDailyActivity(db, userId, delta);
  const profile = await getProfile(db, userId);
  const today = localDate();

  let { streak_current, streak_best } = profile;
  if (profile.last_active_date !== today) {
    streak_current =
      profile.last_active_date === yesterdayOf(today) ? streak_current + 1 : 1;
    streak_best = Math.max(streak_best, streak_current);
  }

  const patch = {
    xp: profile.xp + (delta.xp ?? 0),
    streak_current,
    streak_best,
    last_active_date: today,
  };
  await updateProfile(db, userId, patch);
  return { ...profile, ...patch };
}
