import type { SupabaseClient } from "@supabase/supabase-js";
import type { TextDocument } from "../content/schema";
import type { TextRow, UserTextRow } from "./types";

export async function getTextsForLevel(
  db: SupabaseClient,
  level: string,
): Promise<TextRow[]> {
  const { data, error } = await db
    .from("texts")
    .select("*")
    .eq("level", level)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as TextRow[];
}

export async function getText(db: SupabaseClient, id: string): Promise<TextRow | null> {
  const { data, error } = await db.from("texts").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as TextRow | null;
}

export async function getReadTexts(db: SupabaseClient, userId: string): Promise<UserTextRow[]> {
  const { data, error } = await db.from("user_texts").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as UserTextRow[];
}

export async function getReadTextsWithDocs(db: SupabaseClient, userId: string) {
  const { data, error } = await db
    .from("user_texts")
    .select("*, texts(*)")
    .eq("user_id", userId)
    .order("read_at", { ascending: false });
  if (error) throw error;
  return data as (UserTextRow & { texts: TextRow })[];
}

export async function markTextRead(
  db: SupabaseClient,
  userId: string,
  textId: string,
  wordsTapped: number,
): Promise<void> {
  const { error } = await db.from("user_texts").upsert({
    user_id: userId,
    text_id: textId,
    words_tapped: wordsTapped,
  });
  if (error) throw error;
}

/** Service-role only: cache a generated text (shared across users). */
export async function insertGeneratedText(
  db: SupabaseClient,
  doc: TextDocument,
  vocabHash: string,
  theme?: string,
): Promise<void> {
  const { error } = await db.from("texts").upsert({
    id: doc.id,
    level: doc.level,
    vocab_hash: vocabHash,
    theme: theme ?? null,
    source: "generated",
    doc,
  });
  if (error) throw error;
}
