import type { LanguageProfile } from "../types.ts";
import { buildLexiconIndex } from "./lexicon-index.ts";
import { matchKey, normalizeCatalan, tokenizeCatalan } from "./normalize.ts";
import {
  CULTURAL_SETTING,
  EXPLANATION_FOCUS,
  ORTHOGRAPHY,
  SCENARIOS,
  TEACHER,
  WORD_ROLES,
  CHAT,
} from "./prompts.ts";

/**
 * Catalan (Central / Barcelona standard). ISO 639-1 `ca`.
 *
 * Latin script and left-to-right, so the three capabilities Dari needs are all
 * off: there is nothing to transliterate, no alphabet to teach, and no
 * naskh/nastaliq preference to offer. Turning them off is the whole point of
 * the capability flags - the alphabet route 404s and the font picker
 * disappears rather than rendering an empty shell.
 */
export const ca: LanguageProfile = {
  code: "ca",
  name: "Catalan",
  dir: "ltr",
  fontStack: "var(--font-inter)",
  // Latin script takes normal tracking; unlike Arabic there is nothing to
  // break. Still needs a unit - a bare 0 is dropped when read through var().
  letterSpacing: "normal",

  capabilities: {
    transliteration: false,
    scriptCourse: false,
    fontPicker: false,
  },

  text: {
    normalize: normalizeCatalan,
    matchKey,
    tokenize: tokenizeCatalan,
    buildIndex: buildLexiconIndex,
  },

  brand: {
    // "Riera" is a Catalan seasonal watercourse - the same idea as Darya
    // (Dari for river/sea), so the two apps are siblings by name.
    appName: "Riera",
    nativeName: "Riera",
    tagline: "Learn Catalan",
    description:
      "Learn Catalan by reading: adaptive texts, tap-to-learn vocabulary, and spaced repetition.",
    mascotName: "Poncha",
  },

  samples: {
    // No transliteration: Catalan is already Latin script.
    greeting: { target: "Benvingut", en: "welcome" },
    sentence: { target: "Hola, com estàs?", en: "Hello, how are you?" },
    words: ["llibre", "casa", "jo"],
    phaseGreetings: {
      morning: "Bon dia",
      day: "Hola",
      evening: "Bona tarda",
      night: "Bona nit",
    },
  },

  prompts: {
    teacher: TEACHER,
    orthography: ORTHOGRAPHY,
    culturalSetting: CULTURAL_SETTING,
    scenarios: SCENARIOS,
    inflectionExample: "som bons = we are good",
    explanationFocus: EXPLANATION_FOCUS,
    wordRoles: WORD_ROLES,
    chat: CHAT,
  },
};
