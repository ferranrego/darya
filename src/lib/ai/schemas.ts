import { z } from "zod";
import { chooseTranslationExercise, fillBlankExercise } from "../content/schema.ts";

/**
 * Shapes of the AI-generated payloads that get cached as jsonb in Postgres.
 *
 * These live in a leaf module - pure zod, no `server-only`, no provider chain,
 * no `content/load` (which pulls in megabytes of JSON) - so `scripts/
 * validate-db.ts` can import them under plain Node and check stored blobs
 * against the exact schema the runtime parses them with.
 *
 * That single-source-of-truth matters: the dari -> target rename left 32 cached
 * texts and 121 cached exercises behind, and nothing noticed until a user hit a
 * blank reader. A duplicated copy of these schemas would have drifted the same
 * way.
 */

/** `sentence_explanations.explanation` */
export const sentenceExplanationSchema = z.object({
  words: z.array(
    z.object({
      target: z.string(),
      translit: z.string(),
      gloss: z.string(),
      role: z.string().optional(),
    }),
  ),
  structureEn: z.string(),
});

export type SentenceExplanation = z.infer<typeof sentenceExplanationSchema>;

/** One item of `exercises.data`. */
export const exerciseItemSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("cloze"),
    sentenceTarget: z.string(),
    sentenceTranslit: z.string(),
    sentenceEn: z.string(),
    missingWord: z.string(),
    missingTranslit: z.string(),
    missingEn: z.string().optional(),
    distractors: z.array(z.string()).min(2),
    lexemeId: z.string().optional(),
  }),
  z.object({
    type: z.literal("unscramble"),
    sentenceTarget: z.string(),
    sentenceTranslit: z.string(),
    sentenceEn: z.string(),
    words: z.array(z.string()),
  }),
  z.object({
    type: z.literal("realia"),
    documentType: z.string(),
    markdown: z.string(),
    questionEn: z.string(),
    optionsEn: z.array(z.string()).min(2),
    correctOptionIndex: z.number(),
  }),
  z.object({
    type: z.literal("grammar_detective"),
    correctSentenceTarget: z.string(),
    correctSentenceTranslit: z.string(),
    incorrectSentenceTarget: z.string(),
    incorrectSentenceTranslit: z.string(),
    explanationEn: z.string(),
  }),
]);

export const exerciseOutputSchema = z.object({ exercises: z.array(exerciseItemSchema) });
export type GeneratedExercises = z.infer<typeof exerciseOutputSchema>;
export type ExerciseData = GeneratedExercises["exercises"][number];

/** `grammar_practice.exercise` - model output without ids, direction fixed to toEn. */
export const rawItemSchema = z.union([
  fillBlankExercise.omit({ id: true }),
  chooseTranslationExercise.omit({ id: true }),
]);
