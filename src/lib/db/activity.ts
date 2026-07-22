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
 * The app's canonical timezone. The day boundary is Barcelona midnight for
 * every user (Berlin shares the same clock), so daily XP and streaks roll
 * over at the same instant for everyone. Writes get their date server-side
 * in the record_activity RPC; this client-side mirror is for reads and the
 * midnight rollover timer only.
 */
export const APP_TIMEZONE = "Europe/Madrid";

// en-CA formats as YYYY-MM-DD, which is what Postgres `date` columns expect.
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date as YYYY-MM-DD in Barcelona time. */
export function localDate(d = new Date()): string {
  return dateFormatter.format(d);
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
