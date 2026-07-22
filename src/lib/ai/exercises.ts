
import { z } from "zod";
import { completeJson } from "./providers";
import type { LexiconEntry } from "../content/schema";

const exerciseOutputSchema = z.object({
  exercises: z.array(
    z.discriminatedUnion("type", [
      z.object({
        type: z.literal("cloze"),
        sentenceDari: z.string(),
        sentenceTranslit: z.string(),
        sentenceEn: z.string(),
        missingWord: z.string(),
        missingTranslit: z.string(),
        distractors: z.array(z.string()).min(2),
        lexemeId: z.string().optional(),
      }),
      z.object({
        type: z.literal("unscramble"),
        sentenceDari: z.string(),
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
        correctSentenceDari: z.string(),
        correctSentenceTranslit: z.string(),
        incorrectSentenceDari: z.string(),
        incorrectSentenceTranslit: z.string(),
        explanationEn: z.string(),
      }),
    ])
  )
});

export type GeneratedExercises = z.infer<typeof exerciseOutputSchema>;
export type ExerciseData = GeneratedExercises["exercises"][number];

export interface ExerciseGenerationRequest {
  level: string;
  knownWords: LexiconEntry[];
  targetWords: LexiconEntry[];
  count: number;
}

function buildPrompt(req: ExerciseGenerationRequest): string {
  const known = req.knownWords.map((w) => `${w.dari} (${w.translit})`).join("، ");
  const target = req.targetWords.map((w) => `${w.dari} (${w.translit} = ${w.glossEn})`).join("، ");

  return `You are a Dari language teacher in Kabul creating interactive exercises.
Generate exactly ${req.count} mixed exercises for a student at level ${req.level}.

Types of exercises to include (mix them up):
1. "cloze": A SHORT fill-in-the-blank sentence (3-6 words maximum). Provide the missing word and 3 wrong distractors (must be valid Dari words but wrong for the context).
2. "realia": A short Markdown document (like a menu or sign in Dari) and a multiple-choice question in English about it.
3. "grammar_detective": Two sentences: one grammatically correct and one with a common error. Provide an English explanation.

STRICT VOCABULARY AND NATURALNESS CONSTRAINT:
- MAKE SURE ALL SENTENCES ARE 100% NATURAL AND IDIOMATIC IN DARI. Do NOT generate awkward or word-for-word translated sentences (e.g. do not literally translate "I go to him at home").
- You MUST weave in these new target words: ${target}
- You should primarily use these words the learner already knows: ${known}
- If it is impossible to make a natural, idiomatic sentence using ONLY the known words, you are allowed to introduce 1 or 2 simple, common words that are NOT in the list, but only if absolutely necessary for the sentence to make sense in real life.
- Proper names are allowed sparingly.

Transliteration rules: Latin, Kabuli pronunciation, long vowels ā ē ī ō ū.

Return ONLY JSON with this exact shape:
{
  "exercises": [
    { "type": "cloze", "sentenceDari": "...", "sentenceTranslit": "...", "sentenceEn": "...", "missingWord": "...", "missingTranslit": "...", "distractors": ["...", "..."] },
    { "type": "realia", "documentType": "Menu", "markdown": "...", "questionEn": "...", "optionsEn": ["..."], "correctOptionIndex": 0 },
    { "type": "grammar_detective", "correctSentenceDari": "...", "correctSentenceTranslit": "...", "incorrectSentenceDari": "...", "incorrectSentenceTranslit": "...", "explanationEn": "..." }
  ]
}`;
}

export async function generateExercises(req: ExerciseGenerationRequest): Promise<ExerciseData[]> {
  return completeJson(buildPrompt(req), {
    temperature: 0.7,
    validate: (raw) => {
      const parsed = exerciseOutputSchema.parse(JSON.parse(raw));
      return parsed.exercises;
    },
  });
}
