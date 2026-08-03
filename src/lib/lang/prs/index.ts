import type { LanguageProfile } from "../types.ts";
import { buildLexiconIndex } from "./lexicon-index.ts";
import { matchKey, normalizeDari, tokenizeDari } from "./normalize.ts";
import {
  CULTURAL_SETTING,
  EXPLANATION_FOCUS,
  ORTHOGRAPHY,
  SCENARIOS,
  TEACHER,
  WORD_ROLES,
  CHAT,
  INTERFERENCE,
  BEGINNER_PATTERNS,
  SYNTAX,
} from "./prompts.ts";

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

  samples: {
    greeting: { target: "خوش آمدید", translit: "khush āmadēd", en: "welcome" },
    sentence: { target: "سلام، چطور هستید؟", translit: "salām, chetōr hastēd?", en: "Hello, how are you?" },
    words: ["کتاب", "خانه", "من"],
    phaseGreetings: {
      morning: "Sobh bekheir",
      day: "Salām",
      evening: "Shab bekheir",
      night: "Shab bekheir",
    },
  },

  prompts: {
    teacher: TEACHER,
    orthography: ORTHOGRAPHY,
    interference: INTERFERENCE,
    beginnerPatterns: BEGINNER_PATTERNS,
    culturalSetting: CULTURAL_SETTING,
    scenarios: SCENARIOS,
    inflectionExample: "خوبیم = we are good",
    explanationFocus: EXPLANATION_FOCUS,
    wordRoles: WORD_ROLES,
    chat: CHAT,
    syntax: SYNTAX,
  },
};
