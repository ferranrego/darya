import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserLetterRow } from "./types";
import { type Card, createEmptyCard } from "ts-fsrs";

export async function getUserLetters(
  db: SupabaseClient,
  userId: string,
): Promise<UserLetterRow[]> {
  const { data, error } = await db.from("user_letters").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as UserLetterRow[];
}

export async function initUserLetters(
  db: SupabaseClient,
  userId: string,
  letters: string[],
): Promise<void> {
  const newCard = createEmptyCard(new Date());
  
  const rows = letters.map((char) => ({
    user_id: userId,
    letter_char: char,
    due: newCard.due.toISOString(),
    fsrs: newCard,
  }));

  const { error } = await db.from("user_letters").upsert(rows, { onConflict: "user_id,letter_char" });
  if (error) throw error;
}

export async function updateUserLetter(
  db: SupabaseClient,
  userId: string,
  letterChar: string,
  card: Card,
): Promise<void> {
  const { error } = await db
    .from("user_letters")
    .update({
      due: card.due.toISOString(),
      fsrs: card,
    })
    .eq("user_id", userId)
    .eq("letter_char", letterChar);

  if (error) throw error;
}
