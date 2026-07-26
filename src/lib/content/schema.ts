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

export const CONTENT_FORMAT_VERSION = "1.3.0";

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
  /**
   * Present stem in Persian script for pos=verb entries (کردن → کن). Drives
   * runtime conjugation in lexicon-index. For compound verbs whose light verb
   * has no simple entry of its own, this is the light verb's stem. Absent =
   * no present-tense forms are generated for this entry.
   */
  presentStem: dariText.optional(),
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
  /** Optional short explanation shown under the forms, e.g. the two uses of final ه. */
  note: z.string().optional(),
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
  distractors: z.array(z.string()).min(3),
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
  distractors: z.array(z.string()).min(3),
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

export const recognizeFormExercise = z.object({
  ...exerciseBase,
  type: z.literal("recognizeForm"),
  targetChar: z.string(),
  /** The specific form of the letter to test ("initial", "medial", "final", or "isolated"). */
  targetForm: z.enum(["initial", "medial", "final", "isolated"]),
  /** The actual glyph for the form to show, e.g., "ـبـ" */
  glyph: z.string().min(1),
  distractors: z.array(z.string()).min(3),
});

export const constructWordExercise = z.object({
  ...exerciseBase,
  type: z.literal("constructWord"),
  /** The isolated letters in reading order (RTL). */
  letters: z.array(z.string()).min(2),
  /** The correct joined word, e.g. "باب" */
  targetWord: z.string(),
  /** Distractor joined words */
  distractors: z.array(z.string()).min(3),
});

export const exerciseSchema = z.discriminatedUnion("type", [
  recognizeLetterExercise,
  pickFormExercise,
  matchSoundExercise,
  readWordExercise,
  readSentenceExercise,
  recognizeFormExercise,
  constructWordExercise,
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
// Grammar course: content/grammar/course.json
// ---------------------------------------------------------------------------

/** A Dari word or phrase paired with its transliteration (chips, tiles…). */
export const grammarOptionSchema = z.object({
  dari: dariText,
  translit: translitText,
});

export const grammarExampleSchema = z.object({
  dari: dariText,
  translit: translitText,
  en: z.string().min(1),
  /** Optional substring of `dari` to visually highlight (e.g. "می‌" or "را"). */
  highlight: z.string().optional(),
});

export const grammarSlideSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** 1–3 short sentences of plain-English explanation. */
  body: z.string().min(1),
  examples: z.array(grammarExampleSchema).min(1).max(4),
  /** Optional paradigm table rows: [["man", "hastam"], ["tu", "hasti"], …]. */
  table: z.array(z.tuple([z.string(), z.string()])).optional(),
});

const grammarExerciseBase = {
  id: z.string().min(1),
  /** Optional coaching line shown under the prompt. */
  hint: z.string().optional(),
};

/** Tap the chip that fills the blank in a Dari sentence (covers conjugation drills). */
export const fillBlankExercise = z.object({
  ...grammarExerciseBase,
  type: z.literal("fillBlank"),
  /** Dari sentence with exactly one "___" placeholder. */
  dari: z.string().regex(/^[^_]*___[^_]*$/),
  /** Transliteration with exactly one "___" placeholder. */
  translit: z.string().regex(/^[^_]*___[^_]*$/),
  en: z.string().min(1),
  answer: grammarOptionSchema,
  distractors: z.array(grammarOptionSchema).min(2).max(4),
});

/** Tap word tiles in order to build the Dari sentence for an English prompt. */
export const buildSentenceExercise = z.object({
  ...grammarExerciseBase,
  type: z.literal("buildSentence"),
  en: z.string().min(1),
  /** Correct tiles in logical reading order (first spoken word first). */
  words: z.array(grammarOptionSchema).min(2).max(8),
  /** Transliteration of the full correct sentence. */
  translit: translitText,
  /** Wrong tiles mixed into the bank. */
  extraWords: z.array(grammarOptionSchema).default([]),
  /** Extra accepted orderings; each is a permutation of the `words` dari forms. */
  altOrders: z.array(z.array(z.string()).min(2)).default([]),
});

/** Pick the English meaning of a Dari sentence, or the Dari for an English one. */
export const chooseTranslationExercise = z.object({
  ...grammarExerciseBase,
  type: z.literal("chooseTranslation"),
  direction: z.enum(["toEn", "toDari"]),
  /** toEn: the stimulus. toDari: the correct answer. */
  dari: dariText,
  translit: translitText,
  /** toEn: the correct answer. toDari: the stimulus. */
  en: z.string().min(1),
  /** English distractors (required when direction = toEn). */
  distractorsEn: z.array(z.string()).default([]),
  /** Dari distractors (required when direction = toDari). */
  distractorsDari: z.array(grammarOptionSchema).default([]),
});

/** Tap matching Dari ↔ English pairs until the board clears. */
export const matchPairsExercise = z.object({
  ...grammarExerciseBase,
  type: z.literal("matchPairs"),
  prompt: z.string().min(1),
  pairs: z
    .array(z.object({ dari: dariText, translit: translitText, en: z.string().min(1) }))
    .min(3)
    .max(5),
});

/** Tap the single wrong word in a Dari sentence, then see the correction. */
export const spotErrorExercise = z.object({
  ...grammarExerciseBase,
  type: z.literal("spotError"),
  /** Sentence containing exactly one wrong word (the `errorWord`). */
  dari: dariText,
  translit: translitText,
  /** The intended meaning. */
  en: z.string().min(1),
  /** The wrong token, exactly as it appears in `dari`. */
  errorWord: grammarOptionSchema,
  /** What it should have been. */
  correction: grammarOptionSchema,
});

export const grammarExerciseSchema = z.discriminatedUnion("type", [
  fillBlankExercise,
  buildSentenceExercise,
  chooseTranslationExercise,
  matchPairsExercise,
  spotErrorExercise,
]);

export const grammarLessonSchema = z.object({
  /** "gl-01" … ordered across the whole course. */
  id: z.string().regex(/^gl-\d{2}$/),
  title: z.string().min(1),
  /** One-line promise: "Say who you are with hastam." */
  subtitle: z.string().min(1),
  /** Stable machine tag for the grammar point, e.g. "present-me-prefix". */
  grammarPoint: z.string().min(1),
  /** One-line English description of the point; reused verbatim in AI prompts. */
  grammarPointEn: z.string().min(1),
  slides: z.array(grammarSlideSchema).min(1).max(5),
  exercises: z.array(grammarExerciseSchema).min(6).max(12),
});

export const grammarBlockSchema = z.object({
  /** "gb-01" … ordered. */
  id: z.string().regex(/^gb-\d{2}$/),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  lessons: z.array(grammarLessonSchema).min(1),
});

export const grammarLevelSchema = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);

export const grammarCourseSchema = z.object({
  formatVersion: z.string(),
  language: z.literal("prs"),
  /** CEFR level this course teaches. */
  level: grammarLevelSchema,
  blocks: z.array(grammarBlockSchema).min(1),
});

export type GrammarOption = z.infer<typeof grammarOptionSchema>;
export type GrammarExample = z.infer<typeof grammarExampleSchema>;
export type GrammarSlide = z.infer<typeof grammarSlideSchema>;
export type GrammarExercise = z.infer<typeof grammarExerciseSchema>;
export type GrammarLesson = z.infer<typeof grammarLessonSchema>;
export type GrammarBlock = z.infer<typeof grammarBlockSchema>;
export type GrammarCourse = z.infer<typeof grammarCourseSchema>;
export type GrammarLevel = z.infer<typeof grammarLevelSchema>;

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
// Themes: content/lexicon/themes.json
// ---------------------------------------------------------------------------

export const themeSchema = z.object({
  id: z.string().min(1),
  emoji: z.string().min(1),
  color: z.string().min(1),
});

export const themesFileSchema = z.array(themeSchema);

export type Theme = z.infer<typeof themeSchema>;

// ---------------------------------------------------------------------------
// Texts: content/texts/seed/*.json and AI-generated (same format)
// ---------------------------------------------------------------------------

export const tokenSchema = z.object({
  /** Exact surface form as it appears in the sentence. */
  surface: z.string().min(1),
  /** Lexeme this token resolves to; null for names/punct/unmatched. */
  lexemeId: z.string().nullable(),
  /** Optional syntax role for color-coded grammar highlighting. */
  syntaxRole: z.enum(["subject", "object", "verb"]).optional(),
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
