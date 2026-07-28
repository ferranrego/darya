import type { LanguageProfile } from "../types.ts";
import { buildLexiconIndex } from "./lexicon-index.ts";
import { matchKey, normalizeDari, tokenizeDari } from "./normalize.ts";
import { CULTURAL_SETTING, ORTHOGRAPHY, SCENARIOS, TEACHER } from "./prompts.ts";

/**
 * Dari (Afghan Persian, Kabul standard). ISO 639-3 `prs`.
 *
 * Perso-Arabic script, right-to-left, and written without short vowels - which
 * is why this profile is the one that needs transliteration, a font picker
 * (learners have strong naskh/nastaliq preferences) and an alphabet course.
 */
export const prs: LanguageProfile = {
  code: "prs",
  name: "Dari",
  dir: "rtl",
  // Google TTS has no Dari voice; Persian is the closest usable match.
  ttsLocale: "fa",
  // System voices for Persian are scarce and often broken, so accept Dari and
  // Arabic voices before giving up.
  ttsVoicePrefixes: ["fa", "prs", "ar"],
  fontStack: "var(--font-dari)",
  // Arabic script must never be letterspaced - it breaks the joining forms.
  // Must carry a unit: a bare `0` is valid inline but is dropped as invalid
  // when substituted through var(), silently falling back to `normal`.
  letterSpacing: "0px",

  capabilities: {
    transliteration: true,
    scriptCourse: true,
    fontPicker: true,
  },

  text: {
    normalize: normalizeDari,
    matchKey,
    tokenize: tokenizeDari,
    buildIndex: buildLexiconIndex,
  },

  brand: {
    appName: "Darya",
    nativeName: "دریا",
    tagline: "Learn Dari",
    description:
      "Learn Dari by reading: adaptive texts, tap-to-learn vocabulary, and spaced repetition.",
    mascotName: "Poncha",
  },

  prompts: {
    teacher: TEACHER,
    orthography: ORTHOGRAPHY,
    culturalSetting: CULTURAL_SETTING,
    scenarios: SCENARIOS,
  },
};
