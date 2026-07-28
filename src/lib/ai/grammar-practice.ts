import "server-only";
import { z } from "zod";
import { grammarLessonLevel, lexicon } from "../content/load";
import type { GrammarLevel } from "../content/schema";
import {
  fillBlankExercise,
  chooseTranslationExercise,
  type GrammarExercise,
  type GrammarLesson,
} from "../content/schema";
import { normalize } from "../text";
import { completeJson } from "./providers";
import { assertKnownVocab } from "./vocab-check";
import { profile } from "../lang/index.ts";

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

import { rawItemSchema } from "./schemas.ts";

const outputSchema = z.object({ exercises: z.array(rawItemSchema).min(1) });

function checkItem(item: z.infer<typeof rawItemSchema>) {
  if (item.type === "fillBlank") {
    const answerKey = normalize(item.answer.target);
    for (const d of item.distractors) {
      if (normalize(d.target) === answerKey) throw new Error("Distractor equals answer");
    }
    assertKnownVocab(item.target.replace("___", item.answer.target), MAX_SENTENCE_WORDS);
  } else {
    if (item.direction !== "toEn") throw new Error("Only toEn is generated");
    if (item.distractorsEn.length < 2) throw new Error("Need 2 English distractors");
    if (item.distractorsEn.includes(item.en)) throw new Error("Distractor equals answer");
    assertKnownVocab(item.target, MAX_SENTENCE_WORDS);
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
    .map((e) => `${e.target} - ${e.translit} - "${e.en}"`)
    .join("\n");

  // Most frequent vocabulary up to this level's frequency-band cap.
  const vocab = lexicon.entries
    .filter((e) => e.freqBand <= BAND_CAP[level])
    .sort((a, b) => a.freqRank - b.freqRank)
    .slice(0, 80)
    .map((w) => `${w.target} (${w.translit} = ${w.glossEn})`)
    .join("، ");

  return `You are ${profile.prompts.teacher} writing practice exercises for an ${LEVEL_LABEL[level]} learner.

THE GRAMMAR POINT to drill: ${lesson.grammarPointEn}

Style anchors - the lesson taught exactly these patterns; imitate their difficulty, spelling and transliteration style:
${anchors}

ALLOWED VOCABULARY (use ONLY these words, plus conjugated forms of these verbs and forms of "to be"):
${vocab}

Write ${PRACTICE_BATCH_SIZE} NEW exercises drilling this grammar point. Mix two types:

Type "fillBlank" (about 4 of them): a short Dari sentence (max 7 words) with exactly one blank written as ___ in BOTH target and translit. The blank must test the grammar point. Give the answer and 2-3 wrong options of the same kind (e.g. wrong person endings).

Type "chooseTranslation" (about 2 of them): a short Dari sentence, its transliteration, its correct English meaning in "en", and 2 wrong English meanings in "distractorsEn" that differ ONLY by the grammar point (wrong person, wrong tense, plural vs singular...). Set "direction": "toEn", "distractorsTarget": [].

STRICT RULES:
${profile.prompts.orthography}
- Use ZWNJ in می‌ verb forms (می‌روم).
- Every sentence must be natural and meaningful, never a random pile of words.
- Do not copy the anchor sentences - write new ones.

Return ONLY JSON:
{"exercises": [
  {"type": "fillBlank", "target": "... ___ ...", "translit": "... ___ ...", "en": "...", "answer": {"target": "...", "translit": "..."}, "distractors": [{"target": "...", "translit": "..."}]},
  {"type": "chooseTranslation", "direction": "toEn", "target": "...", "translit": "...", "en": "...", "distractorsEn": ["...", "..."], "distractorsTarget": []}
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
