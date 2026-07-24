import { z } from "zod";
import { completeJson } from "./providers";
import { lexiconIndex } from "../content/load";
import { buildAllowedFormKeys } from "../text/dari-forms";
import { matchKey } from "../text/normalize";
import { lexicon } from "../content/load";

export const sentenceExplanationSchema = z.object({
  words: z.array(
    z.object({
      dari: z.string(),
      translit: z.string(),
      gloss: z.string(),
      role: z.string().optional(),
    })
  ),
  structureEn: z.string(),
});

export type SentenceExplanation = z.infer<typeof sentenceExplanationSchema>;

let allowedFormKeys: Set<string> | null = null;
function allowedForms(): Set<string> {
  allowedFormKeys ??= buildAllowedFormKeys(lexicon.entries);
  return allowedFormKeys;
}

export async function generateSentenceExplanation(dari: string): Promise<SentenceExplanation> {
  const prompt = `You are an expert Persian (Dari) linguist.
I will give you a Dari sentence. Please explain it in detail.

Sentence: "${dari}"

IMPORTANT TRANSLITERATION RULES:
Always use European-friendly phonetic transliteration rather than academic notation.
- Use "kh" for خ (never "x", e.g., "khordan", not "xordan")
- Use "gh" for غ
- Use "sh" for ش
- Use "ch" for چ
- Use "zh" for ژ
Use these rules consistently across all fields (words and structureEn).

Provide:
1. "words": A word-by-word breakdown. For each word in the sentence, provide:
   - "dari": The word in Persian script (as it appears in the sentence).
   - "translit": Latin transliteration.
   - "gloss": A brief English gloss/meaning.
   - "role": (Optional) The grammatical role, like "Subject", "Verb", "Object", "Ezafe", etc.
2. "structureEn": A short paragraph explaining the grammar structure (e.g., tenses used, ezafe chains). Do NOT state obvious word order rules like "The sentence follows a Subject-Object-Verb word order" or "which is common in Dari". Only highlight grammar if it is specific or interesting for this exact sentence.

Return ONLY JSON matching this exact schema:
{
  "words": [
    { "dari": "...", "translit": "...", "gloss": "...", "role": "..." }
  ],
  "structureEn": "..."
}`;

  return completeJson(prompt, {
    temperature: 0.2,
    validate: (raw) => {
      const parsed = JSON.parse(raw);
      const data = sentenceExplanationSchema.parse(parsed);

      // Validate the token list against the lexicon to catch hallucinated glosses/words
      for (const word of data.words) {
        // Strip punctuation for matching if needed, though usually word-by-word break down should just be the words.
        // The tokenization might differ slightly from the AI, so we just check if it's in the lexicon or allowed forms.
        const token = word.dari.replace(/[.,!?،؛:؟]/g, "").trim();
        if (!token) continue;
        
        if (lexiconIndex().resolve(token)) continue;
        if (allowedForms().has(matchKey(token))) continue;
        
        throw new Error(`AI generated unknown or hallucinated word "${token}" not found in lexicon`);
      }

      return data;
    },
  });
}
