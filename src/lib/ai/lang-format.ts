import { z } from "zod";
import type { LexiconEntry } from "../content/schema";
import { profile } from "../lang/index.ts";

/**
 * Language-neutral formatting for everything in `src/lib/ai/`.
 *
 * Every prompt in this directory has to render vocabulary, name the language it
 * wants, and decide whether a transliteration field exists at all. Those three
 * decisions were made independently in each file, and only `generate.ts` made
 * them correctly: the rest hardcoded Dari, so the Catalan build asked a model
 * for sentences "idiomatic in Dari", listed its vocabulary as `casa (undefined)`
 * joined by Arabic commas, and required a `translit` field for a language that
 * has none - which the model dutifully invented (`família` came back
 * transliterated as `famil·lia`, a misspelling printed under the correct word,
 * with no way for the reader to flag it).
 *
 * They live here so there is exactly one place to get them right.
 */

/**
 * Whether this language is transliterated at all.
 *
 * A Latin-script language has nothing to transliterate, and asking for one
 * anyway is not harmless - the model obliges, and invents.
 */
export const TRANSLITERATED = profile.capabilities.transliteration;

/** The language being taught, for prompts: "Dari", "Catalan". */
export const LANGUAGE_NAME = profile.name;

/**
 * Word separator for prompt lists, in the punctuation the language uses.
 * Arabic comma for Perso-Arabic script, plain comma otherwise.
 */
export const LIST_SEP = TRANSLITERATED ? "، " : ", ";

/**
 * A `translit` field the model is only asked for when the language has one.
 *
 * Optional rather than absent so a model that volunteers the field anyway does
 * not fail the parse; callers drop the value when `TRANSLITERATED` is false.
 */
export const translitField = TRANSLITERATED ? z.string().min(1) : z.string().optional();

/** Same, for schemas that require a non-empty string in the transliterated case. */
export const requiredTranslitField = TRANSLITERATED ? z.string() : z.string().optional();

/**
 * Render a vocabulary list for a prompt.
 *
 * The transliteration is only included when the language has one. Without this
 * guard every Catalan word reached the model as `casa (undefined)`, which both
 * wasted the context and taught the model that the parenthesis is meaningful.
 */
export function wordList(words: readonly LexiconEntry[], withGloss = false): string {
  return words
    .map((w) => {
      const parts = [w.target];
      if (TRANSLITERATED && w.translit) parts.push(withGloss ? `(${w.translit} = ${w.glossEn})` : `(${w.translit})`);
      else if (withGloss) parts.push(`(${w.glossEn})`);
      return parts.join(" ");
    })
    .join(LIST_SEP);
}

/**
 * Render one word the way `wordList` would, for prompts that name a single
 * target word rather than a list.
 */
export function wordWithGloss(target: string, translit: string | undefined, glossEn: string): string {
  return TRANSLITERATED && translit ? `"${target}" (${translit} - ${glossEn})` : `"${target}" (${glossEn})`;
}

/**
 * The JSON shape fragment for a sentence, with `translit` only where it exists.
 * Prompts embed this so the example shape and the Zod schema cannot drift.
 */
export function sentenceShape(extra = ""): string {
  const translit = TRANSLITERATED ? `"translit": "...", ` : "";
  return `{"target": "...", ${translit}"en": "..."${extra}}`;
}

/**
 * Instruction line for the transliteration field, or nothing when the language
 * has no transliteration. Prompts interpolate this rather than assuming.
 */
export const TRANSLIT_INSTRUCTION = TRANSLITERATED
  ? `Always include a Latin transliteration in "translit".`
  : `Do NOT include a "translit" field; ${LANGUAGE_NAME} is written in the Latin alphabet and has nothing to transliterate.`;
