import { z } from "zod";

/**
 * Open content schemas for Darya.
 *
 * These are the single source of truth for every content format the app
 * consumes. All files under `content/` validate against them
 * (`pnpm validate:content`), and JSON Schemas are exported to
 * `content/schema/*.schema.json` (`pnpm export:schemas`) so the content can be
 * authored, mixed, and consumed outside this codebase.
 *
 * Compatibility contract: additive changes bump the minor version in
 * `formatVersion`; breaking changes bump the major and require a migration
 * note in docs/CONTENT-SCHEMA.md.
 */

export const CONTENT_FORMAT_VERSION = "1.0.0";

// ---------------------------------------------------------------------------
// Shared
// ---------------------------------------------------------------------------

/** Dari text in Perso-Arabic script (may contain ZWNJ U+200C). */
const dariText = z.string().min(1);

/** Latin transliteration, European-friendly (e.g. "khāna", "salām"). */
const translitText = z.string().min(1);

export const FREQ_BAND_COUNT = 8;

/** 1 = ~100 most frequent words … 8 = rare/literary. */
export const freqBandSchema = z.number().int().min(1).max(FREQ_BAND_COUNT);

export const posSchema = z.enum([
  "noun",
  "verb",
  "adjective",
  "adverb",
  "pronoun",
  "preposition",
  "conjunction",
  "particle",
  "numeral",
  "interjection",
  "determiner",
  "phrase",
]);

export const registerSchema = z.enum(["neutral", "spoken", "formal", "literary"]);

// ---------------------------------------------------------------------------
// Lexicon: content/lexicon/lexicon.json
// ---------------------------------------------------------------------------

export const lexiconEntrySchema = z.object({
  /** Stable ID, never reused: "lx-0001". Per-user data references this. */
  id: z.string().regex(/^lx-\d{4,}$/),
  dari: dariText,
  /** NFC-normalized, ZWNJ preserved, Arabic ي/ك folded to Persian ی/ک. */
  dariNormalized: dariText,
  translit: translitText,
  glossEn: z.string().min(1),
  pos: posSchema,
  /** 1-based rank in the adapted Dari frequency list. */
  freqRank: z.number().int().positive(),
  freqBand: freqBandSchema,
  register: registerSchema,
  /** Surface variants that should resolve to this lexeme when tokenizing. */
  variants: z.array(dariText).default([]),
  exampleDari: dariText,
  exampleTranslit: translitText,
  exampleEn: z.string().min(1),
  audioUrl: z.string().optional(),
  /** Free-form facets: "dari-specific", "loanword", "kabuli", topic tags… */
  tags: z.array(z.string()).default([]),
});

export const lexiconFileSchema = z.object({
  formatVersion: z.string(),
  language: z.literal("prs"),
  glossLanguage: z.literal("en"),
  license: z.string(),
  entries: z.array(lexiconEntrySchema),
});

export type LexiconEntry = z.infer<typeof lexiconEntrySchema>;
export type LexiconFile = z.infer<typeof lexiconFileSchema>;

// ---------------------------------------------------------------------------
// Alphabet course: content/alphabet/course.json
// ---------------------------------------------------------------------------

export const letterFormsSchema = z.object({
  isolated: z.string().min(1),
  initial: z.string().min(1),
  medial: z.string().min(1),
  final: z.string().min(1),
});

export const letterSchema = z.object({
  /** The isolated character, e.g. "پ". Used as the letter's stable ID. */
  char: z.string().min(1),
  /** Dari letter name, e.g. "pe". */
  name: z.string().min(1),
  translit: z.string().min(1),
  /** Plain-English sound description: "p as in pen". */
  sound: z.string().min(1),
  forms: letterFormsSchema,
  /** True for letters that do not join to the following letter (و د ذ ر ز ژ ا). */
  nonConnecting: z.boolean().default(false),
});

const exerciseBase = {
  id: z.string().min(1),
  /** Optional coaching line shown under the prompt. */
  hint: z.string().optional(),
};

/** "Which of these is [name/sound]?" Pick the letter among distractors. */
export const recognizeLetterExercise = z.object({
  ...exerciseBase,
  type: z.literal("recognizeLetter"),
  targetChar: z.string(),
  /** Distractor isolated chars; UI shuffles target in. */
  distractors: z.array(z.string()).min(2),
});

/** "Find [letter] inside this word" by tapping the highlighted-form position. */
export const pickFormExercise = z.object({
  ...exerciseBase,
  type: z.literal("pickForm"),
  targetChar: z.string(),
  word: dariText,
  translit: translitText,
  glossEn: z.string(),
  /** 0-based index of the target letter within the word's characters. */
  targetIndex: z.number().int().min(0),
});

/** "Which letter makes this sound?" */
export const matchSoundExercise = z.object({
  ...exerciseBase,
  type: z.literal("matchSound"),
  sound: z.string(),
  targetChar: z.string(),
  distractors: z.array(z.string()).min(2),
});

/** Read a whole word, self-check against transliteration + gloss. */
export const readWordExercise = z.object({
  ...exerciseBase,
  type: z.literal("readWord"),
  word: dariText,
  translit: translitText,
  glossEn: z.string(),
  /** Multiple-choice transliterations; correct one must equal `translit`. */
  choices: z.array(translitText).min(2),
});

/** Read a short sentence built only from letters taught so far. */
export const readSentenceExercise = z.object({
  ...exerciseBase,
  type: z.literal("readSentence"),
  dari: dariText,
  translit: translitText,
  en: z.string(),
});

export const exerciseSchema = z.discriminatedUnion("type", [
  recognizeLetterExercise,
  pickFormExercise,
  matchSoundExercise,
  readWordExercise,
  readSentenceExercise,
]);

export const alphabetUnitSchema = z.object({
  /** "au-01" … ordered. */
  id: z.string().regex(/^au-\d{2}$/),
  title: z.string().min(1),
  /** One-line promise: "Learn آ، ب، پ and read your first word." */
  subtitle: z.string().min(1),
  letters: z.array(letterSchema),
  exercises: z.array(exerciseSchema).min(1),
});

export const alphabetCourseSchema = z.object({
  formatVersion: z.string(),
  language: z.literal("prs"),
  units: z.array(alphabetUnitSchema).min(1),
});

export type Letter = z.infer<typeof letterSchema>;
export type Exercise = z.infer<typeof exerciseSchema>;
export type AlphabetUnit = z.infer<typeof alphabetUnitSchema>;
export type AlphabetCourse = z.infer<typeof alphabetCourseSchema>;

// ---------------------------------------------------------------------------
// Levels: content/levels/levels.json
// ---------------------------------------------------------------------------

export const levelSchema = z.object({
  /** "L1" … "L6". */
  id: z.string().regex(/^L\d$/),
  name: z.string().min(1),
  cefrHint: z.string().min(1),
  /** Frequency bands a text at this level may draw from. */
  freqBands: z.array(freqBandSchema).min(1),
  /** Known-word count at which a learner typically enters this level. */
  entryKnownWords: z.number().int().min(0),
  /** Sentence count range for generated texts. */
  sentenceRange: z.tuple([z.number().int().positive(), z.number().int().positive()]),
  /** Words per sentence guidance for the generator. */
  sentenceLengthHint: z.string().min(1),
  /** Grammar the generator may use at this level (prompt constraints). */
  grammarAllowed: z.array(z.string()),
});

export const levelsFileSchema = z.object({
  formatVersion: z.string(),
  levels: z.array(levelSchema).min(1),
});

export type Level = z.infer<typeof levelSchema>;
export type LevelsFile = z.infer<typeof levelsFileSchema>;

// ---------------------------------------------------------------------------
// Texts: content/texts/seed/*.json and AI-generated (same format)
// ---------------------------------------------------------------------------

export const tokenSchema = z.object({
  /** Exact surface form as it appears in the sentence. */
  surface: z.string().min(1),
  /** Lexeme this token resolves to; null for names/punct/unmatched. */
  lexemeId: z.string().nullable(),
});

export const sentenceSchema = z.object({
  dari: dariText,
  translit: translitText,
  en: z.string().min(1),
  /** Word tokens in reading order (RTL); punctuation excluded. */
  tokens: z.array(tokenSchema).min(1),
});

export const textDocumentSchema = z.object({
  /** "tx-seed-l1-001" or "tx-gen-<hash>". */
  id: z.string().min(1),
  formatVersion: z.string(),
  level: z.string().regex(/^L\d$/),
  titleDari: dariText,
  titleTranslit: translitText,
  titleEn: z.string().min(1),
  sentences: z.array(sentenceSchema).min(1),
  /** Distinct lexeme IDs used (for cache keying and stats). */
  vocabUsed: z.array(z.string()),
  /** Share of tokens whose lexeme the target learner did not know at creation. */
  newWordRatio: z.number().min(0).max(1),
  source: z.enum(["seed", "generated"]),
  /** Model identifier when source = "generated". */
  model: z.string().optional(),
  createdAt: z.string(),
});

export type TextDocument = z.infer<typeof textDocumentSchema>;
export type Sentence = z.infer<typeof sentenceSchema>;
export type Token = z.infer<typeof tokenSchema>;
