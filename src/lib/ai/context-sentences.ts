import { z } from "zod";
import { completeJson } from "./providers";
import { assertKnownVocab } from "./vocab-check";

const MAX_SENTENCE_WORDS = 12;

const contextSentencesSchema = z.object({
  sentences: z.array(
    z.object({
      target: z.string(),
      translit: z.string(),
      en: z.string(),
    })
  ),
});

export type GeneratedContextSentence = z.infer<typeof contextSentencesSchema>["sentences"][number];

function buildPrompt(wordTarget: string, wordTranslit: string, wordEn: string): string {
  return `You are a Dari language teacher in Kabul. Provide 3 short, natural context sentences that use the word "${wordTarget}" (${wordTranslit} - ${wordEn}).

STRICT VOCABULARY AND NATURALNESS CONSTRAINT:
- Ensure the sentence sounds 100% natural and idiomatic in Dari.
- Keep the sentences short (maximum ${MAX_SENTENCE_WORDS} words).
- Use very simple, common vocabulary for the rest of the sentence, suitable for a beginner/intermediate learner.
- Do NOT use proper names (people or places).

Transliteration rules: Latin, Kabuli pronunciation, long vowels ā ē ī ō ū.

Return ONLY JSON with this exact shape:
{
  "sentences": [
    { "target": "...", "translit": "...", "en": "..." },
    { "target": "...", "translit": "...", "en": "..." },
    { "target": "...", "translit": "...", "en": "..." }
  ]
}`;
}

export async function generateContextSentences(
  wordTarget: string,
  wordTranslit: string,
  wordEn: string,
  count = 3
): Promise<GeneratedContextSentence[]> {
  return completeJson(buildPrompt(wordTarget, wordTranslit, wordEn), {
    temperature: 0.7,
    validate: (raw) => {
      const parsed = contextSentencesSchema.parse(JSON.parse(raw));

      const good: GeneratedContextSentence[] = [];
      const problems: string[] = [];

      for (const sentence of parsed.sentences) {
        try {
          // Relaxed validation: we no longer strictly require the exact infinitive form
          // to be present in the sentence, as verbs will naturally be conjugated.
          assertKnownVocab(sentence.target, MAX_SENTENCE_WORDS);
          good.push(sentence);
        } catch (e) {
          problems.push(e instanceof Error ? e.message : String(e));
        }
      }

      if (problems.length > 0) {
        console.log("Rejected context sentences:", problems.join(" | "));
      }
      if (good.length === 0) {
        throw new Error(`All generated sentences were invalid (${problems.slice(0, 3).join("; ")})`);
      }
      return good.slice(0, count);
    },
  });
}
