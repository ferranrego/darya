import type { SupabaseClient } from "@supabase/supabase-js";
import type { Card } from "ts-fsrs";

import { newCard } from "../srs/scheduler";
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

  // A finished lesson becomes something that comes back. Until now completing
  // one marked it done forever: 93 lessons, no review, no repetition. The card
  // is the grammar point, and the question a later review asks is drawn from
  // this lesson's own written exercises, so none of it costs a model call.
  await startGrammarReview(db, userId, lessonId);
}

export interface GrammarCardRow {
  user_id: string;
  lesson_id: string;
  due: string | null;
  fsrs: Card | null;
  lapses: number;
}

/**
 * Put a completed lesson into review.
 *
 * `ignoreDuplicates`: re-reading a lesson a learner already has in review must
 * not reset its schedule back to day one. Retaking a lesson is something
 * people do when they feel shaky, which is the worst moment to throw away what
 * the scheduler had learned about them.
 */
export async function startGrammarReview(
  db: SupabaseClient,
  userId: string,
  lessonId: string,
): Promise<void> {
  const now = new Date();
  const { error } = await db.from("grammar_cards").upsert(
    {
      user_id: userId,
      lesson_id: lessonId,
      due: now.toISOString(),
      fsrs: newCard(now),
    },
    { ignoreDuplicates: true },
  );
  // Never throws: a learner who just finished a lesson must see their result,
  // not an error because the review card could not be written.
  if (error) console.error("grammar card not created:", error.message);
}

/** Every grammar card this learner holds, for the daily queue. */
export async function getGrammarCards(
  db: SupabaseClient,
  userId: string,
): Promise<GrammarCardRow[]> {
  const { data, error } = await db.from("grammar_cards").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as GrammarCardRow[];
}

/** Record a grammar review. Shares the vocabulary scheduler, deliberately. */
export async function saveGrammarReview(
  db: SupabaseClient,
  userId: string,
  lessonId: string,
  card: Card,
  lapsed: boolean,
  previousLapses: number,
): Promise<void> {
  const { error } = await db.from("grammar_cards").upsert({
    user_id: userId,
    lesson_id: lessonId,
    due: card.due.toISOString(),
    fsrs: card,
    lapses: previousLapses + (lapsed ? 1 : 0),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}
