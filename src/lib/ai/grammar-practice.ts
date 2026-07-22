import "server-only";
import { z } from "zod";
import { grammarLessonLevel, lexicon, lexiconIndex } from "../content/load";
import type { GrammarLevel } from "../content/schema";
import {
  fillBlankExercise,
  chooseTranslationExercise,
  type GrammarExercise,
  type GrammarLesson,
} from "../content/schema";
import { buildAllowedFormKeys } from "../text/dari-forms";
import { matchKey, normalizeDari, tokenizeDari } from "../text/normalize";
import { completeJson } from "./providers";

/**
 * Extra-practice generation for grammar lessons.
 *
 * Only the two machine-verifiable exercise types are generated (fillBlank and
 * chooseTranslation); buildSentence/matchPairs stay hand-authored. Every Dari
 * sentence is checked token-by-token against the lexicon plus the taught verb
 * forms, so a hallucinated word or Iranian-Persian spelling rejects the item.
 * Callers cache results in Postgres (grammar_practice, shared across users),
 * so generation only runs when the pool for a lesson is dry.
 */

export const PRACTICE_BATCH_SIZE = 6;
const MAX_SENTENCE_WORDS = 8;

/** Raw model output: exercises without ids, direction fixed to toEn. */
const rawItemSchema = z.union([
  fillBlankExercise.omit({ id: true }),
  chooseTranslationExercise.omit({ id: true }),
]);

const outputSchema = z.object({ exercises: z.array(rawItemSchema).min(1) });

let allowedFormKeys: Set<string> | null = null;
function allowedForms(): Set<string> {
  allowedFormKeys ??= buildAllowedFormKeys(lexicon.entries);
  return allowedFormKeys;
}

/** Throw unless every token of `dari` is lexicon vocabulary or a taught form. */
function assertKnownVocab(dari: string) {
  const tokens = tokenizeDari(dari);
  if (tokens.length > MAX_SENTENCE_WORDS) throw new Error(`Sentence too long: "${dari}"`);
  for (const token of tokens) {
    if (lexiconIndex().resolve(token)) continue;
    if (allowedForms().has(matchKey(token))) continue;
    throw new Error(`Unknown word "${token}" in "${dari}"`);
  }
}

function checkItem(item: z.infer<typeof rawItemSchema>) {
  if (item.type === "fillBlank") {
    const answerKey = normalizeDari(item.answer.dari);
    for (const d of item.distractors) {
      if (normalizeDari(d.dari) === answerKey) throw new Error("Distractor equals answer");
    }
    assertKnownVocab(item.dari.replace("___", item.answer.dari));
  } else {
    if (item.direction !== "toEn") throw new Error("Only toEn is generated");
    if (item.distractorsEn.length < 2) throw new Error("Need 2 English distractors");
    if (item.distractorsEn.includes(item.en)) throw new Error("Distractor equals answer");
    assertKnownVocab(item.dari);
  }
}

/** Vocabulary band cap per level (A1→3 … C2→8), matching levels.json bands. */
const BAND_CAP: Record<GrammarLevel, number> = { A1: 3, A2: 4, B1: 5, B2: 6, C1: 7, C2: 8 };
const LEVEL_LABEL: Record<GrammarLevel, string> = {
  A1: "A1 beginner",
  A2: "A2 elementary",
  B1: "B1 intermediate",
  B2: "B2 upper-intermediate",
  C1: "C1 advanced",
  C2: "C2 mastery",
};

function buildPrompt(lesson: GrammarLesson): string {
  const level = grammarLessonLevel(lesson.id) ?? "A1";
  const anchors = lesson.slides
    .flatMap((s) => s.examples)
    .map((e) => `${e.dari} — ${e.translit} — "${e.en}"`)
    .join("\n");

  // Most frequent vocabulary up to this level's frequency-band cap.
  const vocab = lexicon.entries
    .filter((e) => e.freqBand <= BAND_CAP[level])
    .sort((a, b) => a.freqRank - b.freqRank)
    .slice(0, 80)
    .map((w) => `${w.dari} (${w.translit} = ${w.glossEn})`)
    .join("، ");

  return `You are a Dari (Afghan Persian, NOT Iranian Persian) teacher writing practice exercises for an ${LEVEL_LABEL[level]} learner.

THE GRAMMAR POINT to drill: ${lesson.grammarPointEn}

Style anchors — the lesson taught exactly these patterns; imitate their difficulty, spelling and transliteration style:
${anchors}

ALLOWED VOCABULARY (use ONLY these words, plus conjugated forms of these verbs and forms of "to be"):
${vocab}

Write ${PRACTICE_BATCH_SIZE} NEW exercises drilling this grammar point. Mix two types:

Type "fillBlank" (about 4 of them): a short Dari sentence (max 7 words) with exactly one blank written as ___ in BOTH dari and translit. The blank must test the grammar point. Give the answer and 2-3 wrong options of the same kind (e.g. wrong person endings).

Type "chooseTranslation" (about 2 of them): a short Dari sentence, its transliteration, its correct English meaning in "en", and 2 wrong English meanings in "distractorsEn" that differ ONLY by the grammar point (wrong person, wrong tense, plural vs singular...). Set "direction": "toEn", "distractorsDari": [].

STRICT RULES:
- Afghan Dari (Kabuli) usage and spelling. Transliteration: long vowels ā ē ī ō ū, mē- for the present prefix, w for و.
- Use ZWNJ in می‌ verb forms (می‌روم).
- Every sentence must be natural and meaningful, never a random pile of words.
- Do not copy the anchor sentences — write new ones.

Return ONLY JSON:
{"exercises": [
  {"type": "fillBlank", "dari": "... ___ ...", "translit": "... ___ ...", "en": "...", "answer": {"dari": "...", "translit": "..."}, "distractors": [{"dari": "...", "translit": "..."}]},
  {"type": "chooseTranslation", "direction": "toEn", "dari": "...", "translit": "...", "en": "...", "distractorsEn": ["...", "..."], "distractorsDari": []}
]}`;
}

export interface PracticeBatch {
  exercises: GrammarExercise[];
  model: string;
}

export async function generatePracticeBatch(lesson: GrammarLesson): Promise<PracticeBatch> {
  return completeJson(buildPrompt(lesson), {
    temperature: 0.7,
    validate: (raw, providerName) => {
      const parsed = outputSchema.parse(JSON.parse(raw));

      // Keep the items that survive constraint checks; a couple of bad ones
      // shouldn't waste the whole batch on the free tier.
      const good: GrammarExercise[] = [];
      const problems: string[] = [];
      for (const item of parsed.exercises) {
        try {
          checkItem(item);
          good.push({ ...item, id: `gp-${crypto.randomUUID()}` } as GrammarExercise);
        } catch (e) {
          problems.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (good.length < 4) {
        throw new Error(`Only ${good.length} valid exercises (${problems.slice(0, 3).join("; ")})`);
      }
      return { exercises: good.slice(0, PRACTICE_BATCH_SIZE), model: providerName };
    },
  });
}
