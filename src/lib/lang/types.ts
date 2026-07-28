import type { LexiconEntry } from "../content/schema.ts";

/**
 * Everything that differs between target languages.
 *
 * The app is a meaning-focused-input reader: it generates graded text, resolves
 * whatever word a learner taps, and schedules that word with FSRS. Only the
 * middle step is language-specific, so this interface is deliberately small -
 * the SRS, auth, stats, push and UI shell know nothing about it.
 *
 * Keep this a plain object registry, not a plugin system. Every profile is
 * bundled (they are a few KB of code; the multi-megabyte part is `content/`,
 * which is aliased per build) so `pnpm typecheck` covers all of them at once.
 */

/** Surface-form → lexeme lookup, built once per lexicon. */
export interface LexiconIndex {
  byId: Map<string, LexiconEntry>;
  resolve: (surface: string) => LexiconEntry | null;
}

export interface LanguageText {
  /** Canonical, display-safe form. Both sides of any comparison pass through this. */
  normalize(input: string): string;
  /** Aggressive lookup key: normalize plus whatever folding only matching needs. */
  matchKey(input: string): string;
  /** Split running text into word tokens, dropping punctuation and whitespace. */
  tokenize(text: string): string[];
  /**
   * Build the surface→lexeme index. This is where morphology lives: Dari
   * generates paradigms from stem pairs, Catalan will look up a precomputed
   * form→lemma map. Callers only ever see `resolve`.
   */
  buildIndex(entries: LexiconEntry[]): LexiconIndex;
}

/**
 * Features that exist only for some languages. Gating on these rather than on
 * the language code keeps `if (lang === "prs")` out of the UI.
 */
export interface LanguageCapabilities {
  /**
   * Whether entries carry a Latin transliteration. True for Perso-Arabic
   * script; false for any language already written in Latin.
   */
  transliteration: boolean;
  /** Whether the alphabet course applies (non-Latin script learners need it). */
  scriptCourse: boolean;
  /** Whether the reader offers a font picker (naskh/nastaliq preferences). */
  fontPicker: boolean;
}

/** Language-specific fragments spliced into the shared prompt templates. */
export interface LanguagePrompts {
  /** e.g. "a Dari language teacher in Kabul". Used as the model's persona. */
  teacher: string;
  /** Orthography and transliteration rules the model must follow. */
  orthography: string;
  /** What generated reader texts should be about, e.g. "everyday Afghan life". */
  culturalSetting: string;
  /** Culturally appropriate settings for generated exercises. */
  scenarios: string[];
}

export interface LanguageProfile {
  /** BCP-47 / ISO code used for the `lang` attribute and content namespacing. */
  code: string;
  /** Human-readable name of the language being learned. */
  name: string;
  dir: "ltr" | "rtl";
  /** Locale passed to the network TTS endpoint. */
  ttsLocale: string;
  /**
   * Voice-language prefixes acceptable for the offline `speechSynthesis`
   * fallback, best first. Separate from `ttsLocale` because the closest
   * available system voice is often not the language itself.
   */
  ttsVoicePrefixes: readonly string[];
  /** CSS custom-property value for the target-text font stack. */
  fontStack: string;
  /** Arabic script must never be letterspaced; Latin can be. */
  letterSpacing: string;
  capabilities: LanguageCapabilities;
  text: LanguageText;
  prompts: LanguagePrompts;
}
