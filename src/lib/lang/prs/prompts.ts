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
  "Use European-friendly digraphs rather than academic notation: kh for خ (never x - khordan, not xordan), gh for غ, sh for ش, ch for چ, zh for ژ. Apply this consistently in every field.",
  "Use ZWNJ in می‌ verb forms (می‌روم).",
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

export const CHAT = {
  translitTask: "Transliterate it. Transliteration rules: Latin, Kabuli pronunciation, long vowels ā ē ī ō ū, use kh/gh/ch/sh/zh/q/', w for و. Example: \"می‌روم\" → \"mērawam\".",
};

/** What is worth highlighting when a sentence is broken down word by word. */
export const EXPLANATION_FOCUS = "tenses used, ezafe chains, compound verbs, the object marker rā";

/** Grammatical roles the word-by-word breakdown may use. */
export const WORD_ROLES = "Subject, Verb, Object, Ezafe, Postposition, Particle";
