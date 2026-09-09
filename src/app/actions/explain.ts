"use server";

import { createHash } from "crypto";
import { generateSentenceExplanation, type SentenceExplanation } from "@/lib/ai/explain";
import { supabaseService } from "@/lib/supabase/server";

export async function explainSentence(
  target: string,
  /**
   * The sentence came from the learner's own imported article rather than from
   * content the app generated. Two consequences: the word-by-word breakdown is
   * checked against the sentence instead of against the lexicon (a real article
   * is full of words the lexicon does not have), and the result is NOT written
   * to the shared cache - a learner may well have pasted in something private,
   * and `sentence_explanations` is a service-role table shared by everyone.
   */
  imported = false,
): Promise<SentenceExplanation | { error: string }> {
  try {
    const normalized = target.trim();
    if (!normalized) return { error: "Empty sentence" };

    if (imported) {
      return await generateSentenceExplanation(normalized, { trustSource: true });
    }

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
    // Logged in full for debugging; the client only ever sees a friendly
    // message - `err.message` here can carry every provider's own error text
    // (rate limits, status codes, response fragments), which used to render
    // verbatim in the sheet's error box.
    console.error("Sentence explanation error:", err);
    return { error: "Couldn't explain this sentence right now. Please try again in a moment." };
  }
}
