import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProfileRow } from "./types";

export async function getProfile(db: SupabaseClient, userId: string): Promise<ProfileRow> {
  const { data, error } = await db.from("profiles").select("*").eq("id", userId).single();
  if (error) throw error;
  return data as ProfileRow;
}

export async function updateProfile(
  db: SupabaseClient,
  userId: string,
  patch: Partial<
    Pick<
      ProfileRow,
      | "display_name"
      | "xp"
      | "streak_current"
      | "streak_best"
      | "last_active_date"
      | "daily_goal"
      | "new_word_ratio"
      | "can_read_script"
      | "level_estimate"
      | "onboarded_at"
    >
  >,
): Promise<void> {
  const { error } = await db.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}
