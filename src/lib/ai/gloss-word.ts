import "server-only";
import { z } from "zod";
import { posSchema } from "../content/schema.ts";
import { profile } from "../lang/index.ts";
import { LANGUAGE_NAME, requiredTranslitField, TRANSLIT_INSTRUCTION, TRANSLITERATED } from "./lang-format.ts";
import { completeJson } from "./providers.ts";

/**
 * Look up a word from an imported article that the shipped lexicon does not
 * have.
 *
 * This is the only path in the app that creates a dictionary entry at runtime,
 * so it is held to the rule CLAUDE.md states for authored content: a wrong
 * entry is worse than a missing one. Everything the model returns is checked
 * before it becomes a personal lexeme, and anything that fails is dropped
 * rather than patched - the learner sees "couldn't look this up", which is
 * honest, instead of a confident wrong gloss they will then memorise.
 *
 * Cost: one call per genuinely new word, and none for any later inflection of
 * it - the entry goes into the learner's own index, which gives it the
 * language's full morphology.
 */

const translit = requiredTranslitField;

export const glossSchema = z.object({
  /** Dictionary form, not the surface that was tapped. */
  lemma: z.string().min(1),
  translit,
  glossEn: z.string().min(1),
  pos: posSchema,
  /**
   * Verbs in a transliterated build need this or the index generates past
   * forms only - see the profile's lexicon-index.
   */
  presentStem: z.string().optional(),
  /**
   * Two questions, not one, because the obvious single question gets a useless
   * answer.
   *
   * Asked only "is this a proper noun?", a model looking at the middle word of
   * a three-part personal name says yes - correctly - and the learner who
   * tapped it is told there is nothing to learn. But the word in that name was
   * an ordinary noun first, and its ordinary meaning is exactly what they
   * wanted. A word can be both at once, so the schema has to be able to say so.
   *
   * `usedAsName`: in THIS sentence, is the token part of a proper name?
   * `isOnlyName`: does the word have no ordinary meaning of its own at all?
   *
   * Only the second one means "not vocabulary".
   */
  usedAsName: z.boolean().default(false),
  isOnlyName: z.boolean().default(false),
  exampleEn: z.string().optional(),
});

export type WordGloss = z.infer<typeof glossSchema>;

/** A gloss this long is a definition, an apology, or a refusal - not a gloss. */
const MAX_GLOSS_CHARS = 60;

export async function glossWord(input: {
  surface: string;
  sentence: string;
  deadline?: number;
}): Promise<WordGloss> {
  const translitKey = TRANSLITERATED ? `"translit": "...", ` : "";
  const stemKey = TRANSLITERATED ? `"presentStem": "...", ` : "";

  const prompt = `You are ${profile.prompts.teacher}. A learner tapped one word while reading and wants to know what it means.
${profile.prompts.orthography}

The word, exactly as it appeared: "${input.surface}"
The sentence it appeared in: "${input.sentence}"

Use the sentence to pick the right meaning - many words have several.

Give:
- "lemma": the dictionary form of that word in ${LANGUAGE_NAME}, not the inflected form that was tapped.
- "glossEn": a short English meaning. A few words, not a definition.
- "pos": its part of speech.
- "usedAsName": true if, in this particular sentence, the word is part of someone's or something's proper name.
- "isOnlyName": true ONLY if the word has no ordinary meaning of its own in ${LANGUAGE_NAME} - it exists purely as a name and would not appear in a dictionary.

These last two are separate questions and the answer is often "true, false".
Many personal and place names are built from ordinary words, and when that
happens the learner still wants the ordinary meaning: give it in "glossEn" and
set "isOnlyName" to false. Reserve "isOnlyName" for a word that means nothing on
its own.
${TRANSLITERATED ? `- "presentStem": for a verb only, its present stem.\n` : ""}- "exampleEn": an English translation of the sentence above.
${TRANSLIT_INSTRUCTION}

Return ONLY JSON matching this exact shape:
{ "lemma": "...", ${translitKey}"glossEn": "...", "pos": "...", ${stemKey}"usedAsName": false, "isOnlyName": false, "exampleEn": "..." }`;

  return completeJson(prompt, {
    temperature: 0.2,
    deadline: input.deadline,
    maxTokens: 300,
    validate: (raw) => {
      const data = glossSchema.parse(JSON.parse(raw));
      if (data.glossEn.length > MAX_GLOSS_CHARS) {
        throw new Error(`Gloss for "${input.surface}" is prose, not a gloss`);
      }
      // A single token cannot be a phrase, and a model that says so has stopped
      // answering the question that was asked.
      if (data.pos === "phrase") {
        throw new Error(`Gloss for "${input.surface}" came back as a phrase`);
      }
      return data;
    },
  });
}

/**
 * Is the lemma plausibly the same word as the surface that was tapped?
 *
 * A model asked about an unfamiliar word sometimes answers about a different,
 * more familiar one. Inflection changes a word's ending far more often than its
 * beginning in both languages here, so a shared opening is a cheap, language-
 * neutral sanity check - and it is a check on the model, not on morphology, so
 * it is deliberately loose.
 *
 * Both arguments must already be match keys.
 */
export function lemmaMatchesSurface(lemmaKey: string, surfaceKey: string): boolean {
  if (lemmaKey === surfaceKey) return true;
  const shortest = Math.min(lemmaKey.length, surfaceKey.length);
  // Two characters is enough signal for a short word and not so much that a
  // prefixing language fails it; three for anything longer.
  const need = shortest <= 3 ? Math.max(1, shortest - 1) : shortest <= 5 ? 2 : 3;
  return lemmaKey.slice(0, need) === surfaceKey.slice(0, need);
}
