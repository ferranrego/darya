"use server";

import { z } from "zod";
import { completeJson } from "@/lib/ai/providers";
import { profile } from "@/lib/lang";

const conjugationRowSchema = z.object({
  person: z.string(),
  target: z.string(),
  translit: z.string(),
  en: z.string(),
});

const conjugationResponseSchema = z.object({
  tense: z.string(),
  person: z.string(),
  conjugation: z.array(conjugationRowSchema),
});

export type ConjugationResponse = z.infer<typeof conjugationResponseSchema>;

export async function analyzeConjugation(
  surface: string,
  root: string,
  glossEn: string
): Promise<ConjugationResponse | { error: string }> {
  const prompt = `You are ${profile.prompts.teacher} and an expert linguist.
I will give you an inflected ${profile.name} word as it appears in a text, and its dictionary root form. This could be a verb, or it could be a noun/adjective acting as a verb with personal endings (e.g. ${profile.prompts.inflectionExample}), or even a plural noun.

Inflected form: "${surface}"
Dictionary root: "${root}" (meaning: "${glossEn}")

Please analyze this inflected word and provide:
1. "tense": The grammatical tense or state (e.g., "Present Indicative", "Present Copula (to be)", "Plural Noun", "Comparative Adjective").
2. "person": The person and number of this specific form (e.g., "1st Person Singular", "Plural", or "N/A" if not applicable).
3. "conjugation": A full table showing how this root inflects. If it takes personal endings (like a verb or adjective+copula), provide exactly 6 rows (1st, 2nd, 3rd person singular, then plural). If it's just a plural noun, you can provide fewer rows (e.g., singular vs plural forms).

For the conjugation table, output the following fields for each of the 6 persons:
- "person": The person (e.g., "1st sg (I)", "2nd sg (You)", "3rd sg (He/She)", "1st pl (We)", "2nd pl (You all)", "3rd pl (They)").
- "target": The conjugated verb in Persian script.
- "translit": The Latin transliteration of the conjugated verb.
- "en": The English meaning of this specific conjugated form.

Return ONLY JSON matching this exact schema:
{
  "tense": "...",
  "person": "...",
  "conjugation": [
    { "person": "...", "target": "...", "translit": "...", "en": "..." },
    ... (6 rows total)
  ]
}
`;

  try {
    const data = await completeJson(prompt, {
      temperature: 0.1,
      validate: (raw) => {
        const parsed = JSON.parse(raw);
        return conjugationResponseSchema.parse(parsed);
      },
    });
    return data;
  } catch (err) {
    console.error("Conjugation error:", err);
    return { error: err instanceof Error ? err.message : "Failed to analyze conjugation" };
  }
}
