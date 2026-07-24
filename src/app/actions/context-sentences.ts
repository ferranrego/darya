"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { generateContextSentences } from "@/lib/ai/context-sentences";
import { lexemeById } from "@/lib/content/load";

export async function getContextSentences(lexemeId: string) {
  const cookieStore = await cookies();
  const db = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );

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
    const generated = await generateContextSentences(entry.dari, entry.translit, entry.glossEn, 3);
    
    // 3. Insert into shared cache
    const rowsToInsert = generated.map((s) => ({
      lexeme_id: lexemeId,
      dari: s.dari,
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
