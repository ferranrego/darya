import type { SupabaseClient } from "@supabase/supabase-js";
import type { LexiconEntry } from "../content/schema";
import type { UserLexemeRow } from "./types";

export async function getUserLexemes(
  db: SupabaseClient,
  userId: string,
): Promise<UserLexemeRow[]> {
  const { data, error } = await db.from("user_lexemes").select("*").eq("user_id", userId);
  if (error) throw error;
  return data as UserLexemeRow[];
}

export async function findUserLexeme(
  db: SupabaseClient,
  userId: string,
  targetNormalized: string,
): Promise<UserLexemeRow | null> {
  const { data, error } = await db
    .from("user_lexemes")
    .select("*")
    .eq("user_id", userId)
    .eq("target_normalized", targetNormalized)
    .maybeSingle();
  if (error) throw error;
  return data as UserLexemeRow | null;
}

export async function insertUserLexeme(
  db: SupabaseClient,
  row: Omit<UserLexemeRow, "created_at" | "updated_at">,
): Promise<void> {
  const { error } = await db.from("user_lexemes").insert(row);
  if (error) throw error;
}

/**
 * Widen an existing entry's surface variants.
 *
 * Tapping a second inflection of a word already in the personal dictionary must
 * cost no model call - it just teaches the index one more surface form. Updates
 * rather than inserts: `user_lexemes` has no delete policy and one row per
 * headword per learner, because `user_words.lexeme_id` points at it.
 */
export async function addUserLexemeVariants(
  db: SupabaseClient,
  id: string,
  variants: string[],
): Promise<void> {
  const { error } = await db
    .from("user_lexemes")
    .update({ variants, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Present a personal row as a lexicon entry.
 *
 * The morphology engine (`profile.text.buildIndex`) takes `LexiconEntry[]`, so
 * this is what gets a personal word its plurals and conjugations. The
 * curriculum fields are filled with values that keep it out of every
 * frequency-ordered calculation: `freqRank`/`freqBand` sit past the end of the
 * lexicon, and the `imported` tag makes its provenance visible in the UI.
 */
export function asLexiconEntry(row: UserLexemeRow): LexiconEntry {
  return {
    id: row.id,
    target: row.target,
    targetNormalized: row.target_normalized,
    translit: row.translit ?? undefined,
    glossEn: row.gloss_en,
    pos: row.pos as LexiconEntry["pos"],
    freqRank: Number.MAX_SAFE_INTEGER,
    freqBand: 10,
    register: "neutral",
    variants: row.variants ?? [],
    presentStem: row.present_stem ?? undefined,
    exampleTarget: row.example_target ?? row.target,
    exampleTranslit: row.example_translit ?? undefined,
    exampleEn: row.example_en ?? row.gloss_en,
    tags: ["imported"],
  };
}
