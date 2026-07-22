import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card, ReviewLog } from "ts-fsrs";
import type { UserWordRow, WordStatus } from "./types";

export async function getUserWords(db: SupabaseClient, userId: string): Promise<UserWordRow[]> {
  const { data, error } = await db.from("user_words").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as UserWordRow[];
}

export async function getDueWords(
  db: SupabaseClient,
  userId: string,
  now: Date,
  limit: number,
): Promise<UserWordRow[]> {
  const { data, error } = await db
    .from("user_words")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "learning")
    .lte("due", now.toISOString())
    .order("due", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return data as UserWordRow[];
}

/** Insert or update one word's SRS state. */
export async function upsertUserWord(
  db: SupabaseClient,
  row: {
    user_id: string;
    lexeme_id: string;
    status: WordStatus;
    due: string | null;
    fsrs: Card | null;
    context_dari?: string | null;
    context_translit?: string | null;
    context_en?: string | null;
  },
): Promise<void> {
  const { error } = await db.from("user_words").upsert(row);
  if (error) throw error;
}

/** Bulk-seed words as already known (onboarding assessment). */
export async function seedKnownWords(
  db: SupabaseClient,
  userId: string,
  lexemeIds: string[],
): Promise<void> {
  if (lexemeIds.length === 0) return;
  const rows = lexemeIds.map((lexeme_id) => ({
    user_id: userId,
    lexeme_id,
    status: "known" as const,
    due: null,
    fsrs: null,
  }));
  const { error } = await db.from("user_words").upsert(rows);
  if (error) throw error;
}

export async function logReview(
  db: SupabaseClient,
  userId: string,
  lexemeId: string,
  rating: number,
  log: ReviewLog,
): Promise<void> {
  const { error } = await db.from("review_logs").insert({
    user_id: userId,
    lexeme_id: lexemeId,
    rating,
    log,
  });
  if (error) throw error;
}
