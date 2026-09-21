import { z } from "zod";
import { completeJson } from "./providers";
import { assertKnownVocab } from "./vocab-check";
import { profile } from "../lang/index.ts";
import { translitProblems } from "../lang/prs/translit-rules.ts";
import { LANGUAGE_NAME, TRANSLITERATED, requiredTranslitField, sentenceShape, wordWithGloss } from "./lang-format.ts";

const MAX_SENTENCE_WORDS = 12;

const contextSentencesSchema = z.object({
  sentences: z.array(
    z.object({
      target: z.string(),
      translit: requiredTranslitField,
      en: z.string(),
    })
  ),
});

export type GeneratedContextSentence = z.infer<typeof contextSentencesSchema>["sentences"][number];

function buildPrompt(wordTarget: string, wordTranslit: string, wordEn: string): string {
  const shape = sentenceShape();
  return `You are ${profile.prompts.teacher}.
${profile.prompts.orthography}
Provide 3 short, natural context sentences that use the word ${wordWithGloss(wordTarget, wordTranslit, wordEn)}.

STRICT VOCABULARY AND NATURALNESS CONSTRAINT:
- Ensure the sentence sounds 100% natural and idiomatic in ${LANGUAGE_NAME}.
- Keep the sentences short (maximum ${MAX_SENTENCE_WORDS} words).
- Use very simple, common vocabulary for the rest of the sentence, suitable for a beginner/intermediate learner.
- Do NOT use proper names (people or places).


Return ONLY JSON with this exact shape:
{
  "sentences": [
    ${shape},
    ${shape},
    ${shape}
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
          /**
           * The orthography rules are in this prompt, and were in the prompt
           * that wrote every sentence now cached: 26 of those 53 break them
           * anyway, with `mi-` for `mē-`, `ketāb` for `kitāb`, `dust` for
           * `dōst`. Nothing looked at the transliteration - `assertKnownVocab`
           * reads the Dari - so a prompt was doing a check's job.
           *
           * Dropped rather than repaired, and dropped one sentence at a time:
           * a wrong entry is worse than a missing one, and the batch only
           * fails, costing a retry, when all three are bad.
           */
          if (TRANSLITERATED && sentence.translit) {
            const bad = translitProblems(sentence.translit, sentence.target);
            if (bad.length > 0) {
              throw new Error(`translit "${sentence.translit}": ${bad.map((b) => b.message).join("; ")}`);
            }
          }
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
