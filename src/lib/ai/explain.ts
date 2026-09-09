import { completeJson } from "./providers";
import { sentenceExplanationSchema, type SentenceExplanation } from "./schemas";
import { isKnownToken } from "./vocab-check";
import { profile } from "../lang/index.ts";
import { matchKey } from "../text/index.ts";
import { LANGUAGE_NAME, TRANSLITERATED } from "./lang-format.ts";

export { sentenceExplanationSchema, type SentenceExplanation };

/**
 * Word-by-word breakdown of a sentence the learner tapped.
 *
 * Every language-specific part of this prompt comes from the profile. It used
 * to open "You are an expert Persian (Dari) linguist", spell out the Dari
 * transliteration scheme, and ask for "ezafe chains" - all of which the Catalan
 * build sent verbatim about Catalan sentences.
 */
export async function generateSentenceExplanation(
  target: string,
  opts: { trustSource?: boolean } = {},
): Promise<SentenceExplanation> {
  const translitLines = TRANSLITERATED
    ? `   - "translit": Latin transliteration, following the rules above, used consistently across every field.\n`
    : "";
  const translitKey = TRANSLITERATED ? `"translit": "...", ` : "";

  const prompt = `You are ${profile.prompts.teacher}, explaining a sentence to a learner.
${profile.prompts.orthography}

I will give you a ${LANGUAGE_NAME} sentence. Please explain it in detail.

Sentence: "${target}"

Provide:
1. "words": A word-by-word breakdown. For each word in the sentence, provide:
   - "target": The word exactly as it appears in the sentence.
${translitLines}   - "gloss": A brief English gloss/meaning.
   - "role": (Optional) The grammatical role: ${profile.prompts.wordRoles}.
2. "structureEn": A short paragraph explaining the grammar structure (e.g. ${profile.prompts.explanationFocus}). Do NOT state obvious word order rules, or say that something "is common in ${LANGUAGE_NAME}". Only highlight grammar if it is specific or interesting for this exact sentence.

Return ONLY JSON matching this exact schema:
{
  "words": [
    { "target": "...", ${translitKey}"gloss": "...", "role": "..." }
  ],
  "structureEn": "..."
}`;

  return completeJson(prompt, {
    temperature: 0.2,
    validate: (raw) => {
      const parsed = JSON.parse(raw);
      const data = sentenceExplanationSchema.parse(parsed);

      // Validate the token list to catch hallucinated glosses/words.
      //
      // Two different premises, so two different checks. For a generated
      // sentence, every word came from the lexicon by construction, so a word
      // outside it means the model invented one. That premise is false for a
      // sentence the learner imported: a real article is full of words the
      // lexicon does not have, and the lexicon check would reject essentially
      // every one - after the call had already been paid for.
      //
      // What actually needs catching either way is a breakdown that discusses
      // words the sentence does not contain, and requiring each one to appear
      // in the sentence catches that directly. It is language-neutral, and
      // strictly stronger than the lexicon check for this purpose.
      const haystack = opts.trustSource ? matchKey(target) : "";
      for (const word of data.words) {
        // Strip punctuation for matching if needed, though usually word-by-word break down should just be the words.
        // The tokenization might differ slightly from the AI, so we just check if it's in the lexicon or allowed forms.
        const token = word.target.replace(/[.,!?،؛:؟]/g, "").trim();
        if (!token) continue;

        if (opts.trustSource) {
          if (haystack.includes(matchKey(token))) continue;
          throw new Error(`AI explained a word "${token}" that is not in the sentence`);
        }

        if (isKnownToken(token)) continue;

        throw new Error(`AI generated unknown or hallucinated word "${token}" not found in lexicon`);
      }

      return data;
    },
  });
}
