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
  /**
   * The mistakes a model makes *in this language specifically*, as explicit
   * "never X, write Y" pairs.
   *
   * Orthography covers spelling; this covers the sentence. Both languages sit
   * next to a dominant relative that supplies most of the training data - the
   * model reaches for Spanish syntax when writing Catalan and for Iranian
   * Persian when writing Dari - and the result is fluent, confident and wrong,
   * which no validator can detect. A false friend shipped in the lexicon this
   * way: `estranyar` glossed "to miss", which is Spanish *extrañar*.
   */
  interference: string;
  /**
   * Model sentences for the first two levels.
   *
   * A beginner does not need a story, they need sentences they can say
   * tomorrow: "El riu és blau", "Quant costa la poma?", "Avui fa sol". The
   * hand-authored seed texts are already like this - four or five independent
   * predications sharing a setting, not a chained narrative - while the prompt
   * demanded "a short story with a beginning and an end" inside two or three
   * sentences of at most six words. That is not writable, and it produced
   * "Soc l'home / No estic / Seré el que serà".
   *
   * Shown as real sentences rather than described as patterns, because a
   * pattern is an abstraction the model has to instantiate and a sentence is
   * one it can imitate.
   */
  beginnerPatterns: string;
  /** What generated reader texts should be about, e.g. "everyday Afghan life". */
  culturalSetting: string;
  /** Culturally appropriate settings for generated exercises. */
  scenarios: string[];
  /**
   * A worked example of a non-verb taking personal endings, for the
   * conjugation-analysis prompt. Language-specific by construction.
   */
  inflectionExample: string;
  /**
   * The grammatical features worth pointing out when breaking a sentence down
   * word by word: "ezafe chains" is illuminating in Dari and meaningless in
   * Catalan, where the equivalent is weak-pronoun combination. Without this the
   * explainer told Catalan learners about ezafe.
   */
  explanationFocus: string;
  /**
   * Grammatical roles the word-by-word breakdown may label, as a prompt hint.
   * Shared roles plus whatever the language actually has.
   */
  wordRoles: string;
  /** Chat enrichment instructions */
  chat: {
    /** The instruction given for the "translit" mode (e.g. phonetic guide or actual transliteration) */
    translitTask: string;
  };
  /** Syntax guardrails specific to the language */
  syntax?: string;
}

/** Product identity. One deployment, one brand. */
export interface LanguageBrand {
  /** Product name: "Darya", "Riera". */
  appName: string;
  /**
   * The product name in the target language's own script, shown above the
   * wordmark on the welcome screen. Identical to `appName` for a Latin-script
   * language; دریا for Dari.
   */
  nativeName: string;
  /** Shown after the name in the title bar: "Learn Dari". */
  tagline: string;
  /** One-line description for metadata and the install manifest. */
  description: string;
  /** The mascot's name, used in guide copy and notifications. */
  mascotName: string;
}

/**
 * Short pieces of the target language the UI renders directly: a greeting on
 * the onboarding screen, a demo sentence, and words the reader guide uses to
 * show tap-to-reveal. These were hardcoded Dari, so the Catalan app greeted
 * users with خوش آمدید.
 */
export interface LanguageSamples {
  /** Greeting on the onboarding welcome step. */
  greeting: { target: string; translit?: string; en: string };
  /** A short natural sentence, used as the chat placeholder. */
  sentence: { target: string; translit?: string; en: string };
  /** Three everyday words for the reader guide's tap-to-reveal demo. */
  words: [string, string, string];
  /** Greetings for the home screen by time of day */
  phaseGreetings: Record<"morning" | "day" | "evening" | "night", string>;
}

export interface LanguageProfile {
  /** BCP-47 / ISO code used for the `lang` attribute and content namespacing. */
  code: string;
  /** Human-readable name of the language being learned. */
  name: string;
  dir: "ltr" | "rtl";
  /**
   * No TTS fields here on purpose. Both apps are text-only by design, so the
   * `useAudio` hook and the `ttsLocale`/`ttsVoicePrefixes` it read were deleted
   * rather than wired up - the hook had been written but never imported by any
   * component. Re-adding them is a product decision, not a gap to fill in.
   */
  /** CSS custom-property value for the target-text font stack. */
  fontStack: string;
  /** Arabic script must never be letterspaced; Latin can be. */
  letterSpacing: string;
  capabilities: LanguageCapabilities;
  text: LanguageText;
  prompts: LanguagePrompts;
  brand: LanguageBrand;
  samples: LanguageSamples;
}
