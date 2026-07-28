import { completeJson } from "./providers";
import { sentenceExplanationSchema, type SentenceExplanation } from "./schemas";
import { isKnownToken } from "./vocab-check";

export { sentenceExplanationSchema, type SentenceExplanation };

export async function generateSentenceExplanation(target: string): Promise<SentenceExplanation> {
  const prompt = `You are an expert Persian (Dari) linguist.
I will give you a Dari sentence. Please explain it in detail.

Sentence: "${target}"

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
   - "target": The word in Persian script (as it appears in the sentence).
   - "translit": Latin transliteration.
   - "gloss": A brief English gloss/meaning.
   - "role": (Optional) The grammatical role, like "Subject", "Verb", "Object", "Ezafe", etc.
2. "structureEn": A short paragraph explaining the grammar structure (e.g., tenses used, ezafe chains). Do NOT state obvious word order rules like "The sentence follows a Subject-Object-Verb word order" or "which is common in Dari". Only highlight grammar if it is specific or interesting for this exact sentence.

Return ONLY JSON matching this exact schema:
{
  "words": [
    { "target": "...", "translit": "...", "gloss": "...", "role": "..." }
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
        const token = word.target.replace(/[.,!?،؛:؟]/g, "").trim();
        if (!token) continue;

        if (isKnownToken(token)) continue;

        throw new Error(`AI generated unknown or hallucinated word "${token}" not found in lexicon`);
      }

      return data;
    },
  });
}
