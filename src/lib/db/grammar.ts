import type { SupabaseClient } from "@supabase/supabase-js";
import type { GrammarProgressRow } from "./types";

export async function getGrammarProgress(
  db: SupabaseClient,
  userId: string,
): Promise<GrammarProgressRow[]> {
  const { data, error } = await db.from("grammar_progress").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as GrammarProgressRow[];
}

export async function completeGrammarLesson(
  db: SupabaseClient,
  userId: string,
  lessonId: string,
  correct: number,
  total: number,
): Promise<void> {
  const { error } = await db.from("grammar_progress").upsert({
    user_id: userId,
    lesson_id: lessonId,
    completed_at: new Date().toISOString(),
    correct,
    total,
  });
  if (error) throw error;
}
