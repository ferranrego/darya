"use server";

import { createHash } from "crypto";
import { generateSentenceExplanation, type SentenceExplanation } from "@/lib/ai/explain";
import { supabaseService } from "@/lib/supabase/server";

export async function explainSentence(dari: string): Promise<SentenceExplanation | { error: string }> {
  try {
    const normalized = dari.trim();
    if (!normalized) return { error: "Empty sentence" };

    const hash = createHash("sha256").update(normalized).digest("hex");
    const db = supabaseService();

    // 1. Check cache
    const { data: cached, error: cacheErr } = await db
      .from("sentence_explanations")
      .select("explanation")
      .eq("sentence_hash", hash)
      .single();

    if (!cacheErr && cached?.explanation) {
      return cached.explanation as SentenceExplanation;
    }

    // 2. Generate
    const explanation = await generateSentenceExplanation(normalized);

    // 3. Cache it (fire and forget / await to ensure consistency)
    const { error: insertErr } = await db
      .from("sentence_explanations")
      .upsert({
        sentence_hash: hash,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        explanation: explanation as any,
      });

    if (insertErr) {
      console.error("Failed to cache sentence explanation:", insertErr);
    }

    return explanation;
  } catch (err) {
    console.error("Sentence explanation error:", err);
    return { error: err instanceof Error ? err.message : "Failed to explain sentence" };
  }
}
