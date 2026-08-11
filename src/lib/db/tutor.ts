import type { SupabaseClient } from "@supabase/supabase-js";
import type { TutorMessageRow } from "./types";

/** Same 48h window as the community room; dropped hourly by pg_cron. */
export const TUTOR_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Oldest first, so the newest message renders at the bottom of the list. */
export async function listTutorMessages(
  db: SupabaseClient,
  limit = 200,
): Promise<TutorMessageRow[]> {
  const { data, error } = await db
    .from("tutor_messages")
    .select("*")
    .gte("created_at", new Date(Date.now() - TUTOR_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as TutorMessageRow[]).reverse();
}

// There is no `sendTutorMessage` here on purpose: the browser cannot insert
// into this table at all (no RLS insert policy), because a learner turn spends
// a shared provider quota. Writes happen server-side in /api/tutor/reply.
