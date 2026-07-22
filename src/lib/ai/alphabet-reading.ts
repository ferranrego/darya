import "server-only";
import { z } from "zod";
import { lexicon } from "../content/load";
import { normalizeDari, ZWNJ } from "../text/normalize";
import { completeJson } from "./providers";

/**
 * Reading-assessment sentence generation for the alphabet course.
 *
 * The learner has only unlocked a handful of letters, so we can't pull a
 * canned graded reader. Instead we find every lexicon word spellable with the
 * known letters, hand that pool to the free-tier provider chain, and ask for
 * one short but *real* sentence. Output is verified to use known letters only,
 * so a hallucinated word (or Iranian-Persian spelling) rejects the attempt and
 * the chain retries.
 */

/** Punctuation and separators allowed in output regardless of known letters. */
const ALLOWED_PUNCT = new Set([" ", ZWNJ, "،", "؟", "؛", ".", "!", "؟", "?", "‏"]);

const outputSchema = z.object({
  dari: z.string().min(1),
  translit: z.string().min(1),
  en: z.string().min(1),
});

export interface ReadingSentence {
  id: string;
  type: "readSentence";
  dari: string;
  translit: string;
  en: string;
}

/** Words whose every character is a letter the learner already knows. */
export function spellableWords(knownLetters: string[]) {
  const known = new Set(knownLetters);
  return lexicon.entries
    .filter((entry) => {
      const chars = Array.from(normalizeDari(entry.dariNormalized || entry.dari));
      return chars.every((c) => known.has(c) || ALLOWED_PUNCT.has(c));
    })
    .sort((a, b) => a.freqRank - b.freqRank);
}

function buildPrompt(words: { dari: string; translit: string; glossEn: string }[]): string {
  const list = words.map((w) => `${w.dari} (${w.translit} = ${w.glossEn})`).join("، ");

  return `You are a Dari (Afghan Persian, NOT Iranian Persian) teacher helping an absolute beginner who has only learned a few letters.

Below is the COMPLETE list of words the learner can currently read. Every one is spellable with the letters they know:
${list}

Write ONE very short but REAL and MEANINGFUL Dari sentence (2 to 5 words) that a beginner would understand.

STRICT RULES:
- Use ONLY words from the list above. You may use a word more than once. Do NOT invent or inflect words in a way that introduces any letter not present in the listed words.
- The sentence must be natural and actually make sense — not a random pile of words.
- If the list is tiny, a 2-word phrase is fine (e.g. a greeting or a "noun is adjective" statement).
- Use Afghan Dari usage and spelling.

Transliteration: Latin, Kabuli pronunciation, long vowels ā ē ī ō ū (kh/gh/ch/sh/zh/q, w for و).

Return ONLY JSON: {"dari": "...", "translit": "...", "en": "..."}`;
}

export async function generateReadingSentence(knownLetters: string[]): Promise<ReadingSentence> {
  const known = new Set(knownLetters);
  const pool = spellableWords(knownLetters);

  if (pool.length < 2) {
    throw new Error("Not enough vocabulary unlocked to form a sentence.");
  }

  // Cap the pool so the prompt stays small; most-frequent words first.
  const offered = pool.slice(0, 150);

  return completeJson(buildPrompt(offered), {
    temperature: 0.7,
    validate: (raw) => {
      const parsed = outputSchema.parse(JSON.parse(raw));
      const chars = Array.from(normalizeDari(parsed.dari));

      // Hard constraint: the learner must be able to read every character.
      const unknown = chars.find((c) => !known.has(c) && !ALLOWED_PUNCT.has(c));
      if (unknown) {
        throw new Error(`Sentence uses unknown character "${unknown}"`);
      }

      const wordCount = parsed.dari.trim().split(/\s+/).filter(Boolean).length;
      if (wordCount < 2) {
        throw new Error("Sentence too short");
      }

      return {
        id: "gen-" + Date.now(),
        type: "readSentence" as const,
        dari: parsed.dari.trim(),
        translit: parsed.translit.trim(),
        en: parsed.en.trim(),
      };
    },
  });
}
