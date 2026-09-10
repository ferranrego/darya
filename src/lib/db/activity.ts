import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyActivityRow } from "./types";

/** Deltas accepted by the record_activity RPC (see gamification.ts). */
export interface ActivityDelta {
  xp?: number;
  reviews_done?: number;
  texts_read?: number;
  words_learned?: number;
}

/**
 * The fallback day boundary, for a learner whose profile has no timezone.
 *
 * This used to be the day boundary for everyone on earth, which meant a
 * learner in Kabul lost their streak at half past two in the afternoon. The
 * day is now a property of the learner: `profiles.timezone`, applied in the
 * record_activity RPC for writes and here for reads and the rollover timer.
 * Rows that predate the column keep this value, so nothing shifts under
 * anyone who was already using the app.
 */
export const APP_TIMEZONE = "Europe/Madrid";

// en-CA formats as YYYY-MM-DD, which is what Postgres `date` columns expect.
// Formatters are not free to construct, and this runs on every read, so keep
// one per zone rather than one per call.
const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatters.get(timeZone);
  if (cached) return cached;
  const made = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatters.set(timeZone, made);
  return made;
}

/** Calendar date as YYYY-MM-DD in the learner's own timezone. */
export function localDate(d = new Date(), timeZone: string | null = null): string {
  try {
    return formatterFor(timeZone ?? APP_TIMEZONE).format(d);
  } catch {
    // An unknown or malformed zone must not break the daily counters.
    return formatterFor(APP_TIMEZONE).format(d);
  }
}

/** The browser's own zone, or null when it cannot be determined. */
export function detectTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/** Today's activity row, or null when the user has not earned anything yet today. */
export async function getTodayActivity(
  db: SupabaseClient,
  userId: string,
): Promise<DailyActivityRow | null> {
  const { data, error } = await db
    .from("daily_activity")
    .select("*")
    .eq("user_id", userId)
    .eq("date", localDate())
    .maybeSingle();
  if (error) throw error;
  return (data as DailyActivityRow) ?? null;
}

/** Get activity history for the user over the last N days. */
export async function getHistoryActivity(
  db: SupabaseClient,
  userId: string,
  limitDays: number = 365,
): Promise<DailyActivityRow[]> {
  const { data, error } = await db
    .from("daily_activity")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(limitDays);
  if (error) throw error;
  return (data as DailyActivityRow[]) ?? [];
}
