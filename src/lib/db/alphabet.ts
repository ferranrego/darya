import type { SupabaseClient } from "@supabase/supabase-js";
import type { AlphabetProgressRow } from "./types";

export async function getAlphabetProgress(
  db: SupabaseClient,
  userId: string,
): Promise<AlphabetProgressRow[]> {
  const { data, error } = await db.from("alphabet_progress").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as AlphabetProgressRow[];
}

export async function completeAlphabetUnit(
  db: SupabaseClient,
  userId: string,
  unitId: string,
  correct: number,
  total: number,
): Promise<void> {
  const { error } = await db.from("alphabet_progress").upsert({
    user_id: userId,
    unit_id: unitId,
    completed_at: new Date().toISOString(),
    correct,
    total,
  });
  if (error) throw error;
}
