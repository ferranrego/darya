import { z } from "zod";
import { chooseTranslationExercise, fillBlankExercise } from "../content/schema.ts";
import { requiredTranslitField } from "./lang-format.ts";

/**
 * Shapes of the AI-generated payloads that get cached as jsonb in Postgres.
 *
 * These live in a leaf module - pure zod, no `server-only`, no provider chain,
 * no `content/load` (which pulls in megabytes of JSON) - so `scripts/
 * validate-db.ts` can import them under plain Node and check stored blobs
 * against the exact schema the runtime parses them with. `lang-format` keeps
 * that property: it reaches `src/lib/lang/`, which is a few KB of code and
 * pulls in no content.
 *
 * That single-source-of-truth matters: the dari -> target rename left 32 cached
 * texts and 121 cached exercises behind, and nothing noticed until a user hit a
 * blank reader. A duplicated copy of these schemas would have drifted the same
 * way.
 *
 * Every `translit` here is required in a transliterated language and absent in
 * a Latin-script one. It used to be unconditionally required, which meant the
 * Catalan build rejected any exercise batch where the model sensibly declined
 * to transliterate Catalan - and accepted the batches where it complied and
 * invented one. Loosening it for Catalan does not loosen it for Dari: the
 * constant is resolved per build, and existing Dari rows still validate.
 */

/** `sentence_explanations.explanation` */
export const sentenceExplanationSchema = z.object({
  words: z.array(
    z.object({
      target: z.string(),
      translit: requiredTranslitField,
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
    sentenceTranslit: requiredTranslitField,
    sentenceEn: z.string(),
    missingWord: z.string(),
    missingTranslit: requiredTranslitField,
    missingEn: z.string().optional(),
    distractors: z.array(z.string()).min(2),
    lexemeId: z.string().optional(),
  }),
  z.object({
    type: z.literal("unscramble"),
    sentenceTarget: z.string(),
    sentenceTranslit: requiredTranslitField,
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
    correctSentenceTranslit: requiredTranslitField,
    incorrectSentenceTarget: z.string(),
    incorrectSentenceTranslit: requiredTranslitField,
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
