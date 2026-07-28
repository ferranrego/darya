"use server";

import { supabaseService } from "@/lib/supabase/server";
import { generateContextSentences } from "@/lib/ai/context-sentences";
import { lexemeById } from "@/lib/content/load";

export async function getContextSentences(lexemeId: string) {
  const db = supabaseService();

  // 1. Check shared cache
  const { data: cached, error } = await db
    .from("lexeme_context_sentences")
    .select("*")
    .eq("lexeme_id", lexemeId);

  if (error) {
    console.error("Error fetching context sentences:", error);
    return [];
  }

  if (cached && cached.length >= 2) {
    return cached;
  }

  // 2. Generate if cache is empty or insufficient
  const entry = lexemeById(lexemeId);
  if (!entry) {
    throw new Error(`Unknown lexeme ID: ${lexemeId}`);
  }

  try {
    const generated = await generateContextSentences(entry.target, entry.translit ?? "", entry.glossEn, 3);
    
    // 3. Insert into shared cache
    const rowsToInsert = generated.map((s) => ({
      lexeme_id: lexemeId,
      target: s.target,
      translit: s.translit,
      en: s.en,
    }));

    const { data: inserted, error: insertError } = await db
      .from("lexeme_context_sentences")
      .insert(rowsToInsert)
      .select();

    if (insertError) {
      console.error("Error inserting context sentences:", insertError);
      // Even if insertion fails, return the generated sentences so the UI works
      return rowsToInsert;
    }

    return inserted;
  } catch (err) {
    console.error("Error generating context sentences:", err);
    return [];
  }
}
