import type { LanguageProfile } from "../types.ts";
import { buildLexiconIndex } from "./lexicon-index.ts";
import { matchKey, normalizeCatalan, tokenizeCatalan } from "./normalize.ts";
import { CULTURAL_SETTING, ORTHOGRAPHY, SCENARIOS, TEACHER } from "./prompts.ts";

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
  ttsLocale: "ca",
  // Google and most systems ship a real Catalan voice; Spanish is an
  // intelligible last resort rather than a good one.
  ttsVoicePrefixes: ["ca", "es"],
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

  prompts: {
    teacher: TEACHER,
    orthography: ORTHOGRAPHY,
    culturalSetting: CULTURAL_SETTING,
    scenarios: SCENARIOS,
  },
};
