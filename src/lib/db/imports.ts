import type { SupabaseClient } from "@supabase/supabase-js";
import type { ImportedTextRow } from "./types";

export async function getImports(
  db: SupabaseClient,
  userId: string,
): Promise<ImportedTextRow[]> {
  const { data, error } = await db
    .from("imported_texts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as ImportedTextRow[];
}

export async function getImport(
  db: SupabaseClient,
  id: string,
): Promise<ImportedTextRow | null> {
  const { data, error } = await db
    .from("imported_texts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as ImportedTextRow | null;
}

export async function insertImport(
  db: SupabaseClient,
  row: Omit<ImportedTextRow, "created_at" | "read_at" | "words_tapped">,
): Promise<void> {
  const { error } = await db.from("imported_texts").insert(row);
  if (error) throw error;
}

/** Progress for an import lives on its own row - it has no `user_texts` entry. */
export async function markImportRead(
  db: SupabaseClient,
  id: string,
  wordsTapped: number,
): Promise<void> {
  const { error } = await db
    .from("imported_texts")
    .update({ read_at: new Date().toISOString(), words_tapped: wordsTapped })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Patch one sentence's translation in place.
 *
 * Goes through an RPC rather than a read-modify-write of `doc`: two sentences
 * expanded in quick succession would otherwise race, and the later write would
 * drop the earlier one's translation.
 */
export async function setImportedSentence(
  db: SupabaseClient,
  id: string,
  index: number,
  en: string,
  translit?: string,
): Promise<void> {
  const { error } = await db.rpc("set_imported_sentence", {
    p_id: id,
    p_index: index,
    p_en: en,
    p_translit: translit ?? null,
  });
  if (error) throw error;
}

/**
 * Remove an import the learner is done with.
 *
 * Deliberately deletes ONLY the article. The words looked up while reading it
 * are ordinary vocabulary by now, with their own SRS history, and they live in
 * `user_lexemes` / `user_words` - neither of which references this table.
 * `user_lexemes.source_text_id` is a foreign key with ON DELETE SET NULL, so
 * the database itself guarantees that deleting an import can clear that one
 * pointer and nothing more; and `user_lexemes` has no delete policy at all, so
 * a personal word cannot be removed through the app by any route.
 *
 * The sentence each word was met in is stored inline on both rows, so review
 * cards keep their context after the article is gone.
 */
export async function deleteImport(db: SupabaseClient, id: string): Promise<void> {
  const { error } = await db.from("imported_texts").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Record that a token is a proper noun, everywhere it appears in the article.
 *
 * Names repeat throughout a news article, and a name is the one lookup that
 * produces no dictionary entry - so without this, every occurrence and every
 * re-reading costs another model call on the shared quota, and every one of
 * them is offered to the learner as new vocabulary.
 */
export async function markImportedName(
  db: SupabaseClient,
  id: string,
  surface: string,
): Promise<void> {
  const { error } = await db.rpc("mark_imported_name", { p_id: id, p_surface: surface });
  if (error) throw error;
}

export async function countImportsSince(
  db: SupabaseClient,
  userId: string,
  since: Date,
): Promise<number> {
  const { count, error } = await db
    .from("imported_texts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());
  if (error) throw error;
  return count ?? 0;
}
