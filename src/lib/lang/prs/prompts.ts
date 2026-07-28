/**
 * Dari-specific fragments spliced into the shared prompt templates in
 * `src/lib/ai/`. The templates own the task ("write a graded reader text at
 * this level"); this file owns everything that would be wrong for another
 * language - the persona, the orthography rules, the cultural settings.
 *
 * Kept as data rather than inlined so `src/lib/ai/` stays language-neutral.
 */

/** Persona. Dari is Afghan Persian; the model drifts to Iranian Persian unless told. */
export const TEACHER = "a Dari language teacher in Kabul";

/**
 * Transliteration and spelling rules. Every prompt that emits Dari or translit
 * repeats these, so they live in one place - they were previously duplicated,
 * with drift, across six prompt files.
 */
export const ORTHOGRAPHY = [
  "Write standard Afghan Dari, NOT Iranian Persian: use Dari vocabulary (مکتب، موتر، کلان) and Kabuli usage.",
  "Transliteration is Latin with Kabuli pronunciation: long vowels ā ē ī ō ū; kh/gh/ch/sh/zh/q; w for و; mē- for the present prefix.",
].join("\n");

/** What generated reader texts should be about, culturally. */
export const CULTURAL_SETTING = "everyday Afghan life";

/** Fallback settings for generated exercises when vocabulary has no usable tags. */
export const SCENARIOS = [
  "at the bazaar",
  "at home with family",
  "traveling in Afghanistan",
  "with friends over tea",
  "at work",
  "at a restaurant",
];
