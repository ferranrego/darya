import type { SupabaseClient } from "@supabase/supabase-js";
import type { DailyActivityRow } from "./types";

export interface ActivityDelta {
  xp?: number;
  reviews_done?: number;
  texts_read?: number;
  words_learned?: number;
}

/** Local calendar date as YYYY-MM-DD (streaks are user-local by design). */
export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function bumpDailyActivity(
  db: SupabaseClient,
  userId: string,
  delta: ActivityDelta,
): Promise<DailyActivityRow> {
  const date = localDate();
  const { data: existing, error: readError } = await db
    .from("daily_activity")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();
  if (readError) throw readError;

  const row: DailyActivityRow = {
    user_id: userId,
    date,
    xp: (existing?.xp ?? 0) + (delta.xp ?? 0),
    reviews_done: (existing?.reviews_done ?? 0) + (delta.reviews_done ?? 0),
    texts_read: (existing?.texts_read ?? 0) + (delta.texts_read ?? 0),
    words_learned: (existing?.words_learned ?? 0) + (delta.words_learned ?? 0),
  };
  const { error } = await db.from("daily_activity").upsert(row);
  if (error) throw error;
  return row;
}

export async function getRecentActivity(
  db: SupabaseClient,
  userId: string,
  days: number,
): Promise<DailyActivityRow[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await db
    .from("daily_activity")
    .select("*")
    .eq("user_id", userId)
    .gte("date", localDate(since))
    .order("date", { ascending: false });
  if (error) throw error;
  return data as DailyActivityRow[];
}
