import { z } from "zod";
import { lexiconIndex } from "../content/load";
import type { LexiconEntry } from "../content/schema";
import { normalize, tokenize } from "../text";
import { shuffle } from "../util/shuffle";
import { completeJson } from "./providers";
import { assertKnownVocab } from "./vocab-check";
import { profile } from "../lang/index.ts";

const MAX_SENTENCE_WORDS = 10;

const exerciseOutputSchema = z.object({
  exercises: z.array(
    z.discriminatedUnion("type", [
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
    ])
  )
});

export type GeneratedExercises = z.infer<typeof exerciseOutputSchema>;
export type ExerciseData = GeneratedExercises["exercises"][number];

export interface ExerciseGenerationRequest {
  level: string;
  knownWords: LexiconEntry[];
  /** SRS words the learner is actively studying - each exercise should test one. */
  learningTargets: LexiconEntry[];
  /** Brand-new in-band words to introduce gently. */
  newTargets: LexiconEntry[];
  count: number;
  /** Scenario/theme to set the exercises in, e.g. "at the bazaar". */
  theme?: string;
  /** Dari sentences from recent exercises the model must not reuse. */
  avoidSentences?: string[];
}

/**
 * Fallback scenarios when the sampled vocabulary has no usable tags. Culturally
 * specific ("traveling in Afghanistan"), so it comes from the language profile.
 */
export const FALLBACK_THEMES = profile.prompts.scenarios;

/**
 * Randomly split `count` across the three generated exercise types, always
 * keeping at least one cloze (the type that most directly tests target words).
 */
function randomTypeMix(count: number): Record<"cloze" | "realia" | "grammar_detective", number> {
  const mix = { cloze: Math.min(1, count), realia: 0, grammar_detective: 0 };
  const weighted: (keyof typeof mix)[] = [
    "cloze", "cloze", "cloze", "realia", "realia", "grammar_detective", "grammar_detective",
  ];
  for (let i = mix.cloze; i < count; i++) {
    mix[weighted[Math.floor(Math.random() * weighted.length)]]++;
  }
  return mix;
}

function buildPrompt(req: ExerciseGenerationRequest): string {
  const known = shuffle(req.knownWords).map((w) => `${w.target} (${w.translit})`).join("، ");
  const learning = req.learningTargets
    .map((w) => `${w.target} (${w.translit} = ${w.glossEn})`)
    .join("، ");
  const fresh = req.newTargets
    .map((w) => `${w.target} (${w.translit} = ${w.glossEn})`)
    .join("، ");

  const mix = randomTypeMix(req.count);
  const mixLine = Object.entries(mix)
    .filter(([, n]) => n > 0)
    .map(([type, n]) => `${n} of type "${type}"`)
    .join(", ");

  const avoid = (req.avoidSentences ?? []).filter(Boolean);

  return `You are ${profile.prompts.teacher} creating interactive exercises.
${profile.prompts.orthography}
Generate exactly ${req.count} exercises for a student at level ${req.level}: ${mixLine}.
${req.theme ? `Set the exercises in this scenario/theme where it fits naturally: ${req.theme}.` : ""}

Types of exercises:
1. "cloze": A SHORT fill-in-the-blank sentence (3-6 words maximum). "sentenceTarget" MUST be the COMPLETE sentence containing the missing word - do NOT replace it with blanks, underscores, or dots (the UI renders the blank itself). "missingWord" must appear verbatim in "sentenceTarget". Provide the missing word, its English translation ("missingEn"), and 3 wrong distractors (must be valid Dari words but wrong for the context).
2. "realia": A short Markdown document (like a menu or sign in Dari) and a multiple-choice question in English about it.
3. "grammar_detective": Two sentences: one grammatically correct and one with a common error. Provide an English explanation.

STRICT VOCABULARY AND NATURALNESS CONSTRAINT:
- MAKE SURE ALL SENTENCES ARE 100% NATURAL AND IDIOMATIC IN DARI. Do NOT generate awkward or word-for-word translated sentences (e.g. do not literally translate "I go to him at home").
${learning ? `- WORDS THE STUDENT IS CURRENTLY STUDYING - each exercise must test one of these as its focus (e.g. as the cloze missing word): ${learning}` : ""}
${fresh ? `- Brand-new words to introduce gently in one or two exercises: ${fresh}` : ""}
- You should primarily use these words the learner already knows: ${known}
- If it is impossible to make a natural, idiomatic sentence using ONLY the known words, you are allowed to introduce 1 or 2 simple, common words that are NOT in the list, but only if absolutely necessary for the sentence to make sense in real life.
- Do NOT use proper names (people or places) in cloze or grammar_detective sentences; they are fine inside realia documents.
${avoid.length > 0 ? `\nDo NOT reuse or closely paraphrase any of these previously used sentences:\n${avoid.map((s) => `- ${s}`).join("\n")}` : ""}


Return ONLY JSON with this exact shape:
{
  "exercises": [
    { "type": "cloze", "sentenceTarget": "...", "sentenceTranslit": "...", "sentenceEn": "...", "missingWord": "...", "missingTranslit": "...", "missingEn": "...", "distractors": ["...", "..."] },
    { "type": "realia", "documentType": "Menu", "markdown": "...", "questionEn": "...", "optionsEn": ["..."], "correctOptionIndex": 0 },
    { "type": "grammar_detective", "correctSentenceTarget": "...", "correctSentenceTranslit": "...", "incorrectSentenceTarget": "...", "incorrectSentenceTranslit": "...", "explanationEn": "..." }
  ]
}`;
}

/** Throw if an exercise is malformed or uses hallucinated vocabulary. */
function checkItem(ex: ExerciseData) {
  switch (ex.type) {
    case "cloze": {
      if (!ex.sentenceTarget.includes(ex.missingWord)) {
        throw new Error(`Missing word "${ex.missingWord}" not in "${ex.sentenceTarget}"`);
      }
      const answerKey = normalize(ex.missingWord);
      for (const d of ex.distractors) {
        if (normalize(d) === answerKey) throw new Error("Distractor equals answer");
      }
      assertKnownVocab(ex.sentenceTarget, MAX_SENTENCE_WORDS);
      break;
    }
    case "unscramble": {
      assertKnownVocab(ex.sentenceTarget, MAX_SENTENCE_WORDS);
      const sentenceKeys = new Set(tokenize(ex.sentenceTarget).map(normalize));
      for (const w of ex.words) {
        if (!sentenceKeys.has(normalize(w))) {
          throw new Error(`Unscramble word "${w}" not in sentence`);
        }
      }
      break;
    }
    case "grammar_detective":
      // Only the correct sentence is validated; the incorrect one is wrong on purpose.
      assertKnownVocab(ex.correctSentenceTarget, MAX_SENTENCE_WORDS);
      break;
    case "realia":
      if (ex.correctOptionIndex < 0 || ex.correctOptionIndex >= ex.optionsEn.length) {
        throw new Error("correctOptionIndex out of range");
      }
      break;
  }
}

/**
 * The target lexemes an exercise actually practices: tokenize its Dari text,
 * resolve through the lexicon index (robust to inflected forms), and keep the
 * ids that are in `targetIds`.
 */
export function taggedLexemes(ex: ExerciseData, targetIds: Set<string>): string[] {
  const texts: string[] = [];
  switch (ex.type) {
    case "cloze":
      texts.push(ex.sentenceTarget, ex.missingWord);
      break;
    case "unscramble":
      texts.push(ex.sentenceTarget);
      break;
    case "grammar_detective":
      texts.push(ex.correctSentenceTarget);
      break;
    case "realia":
      texts.push(ex.markdown);
      break;
  }
  const found = new Set<string>();
  for (const text of texts) {
    for (const token of tokenize(text)) {
      const entry = lexiconIndex().resolve(token);
      if (entry && targetIds.has(entry.id)) found.add(entry.id);
    }
  }
  return Array.from(found);
}

export async function generateExercises(req: ExerciseGenerationRequest): Promise<ExerciseData[]> {
  return completeJson(buildPrompt(req), {
    temperature: 0.85,
    validate: (raw) => {
      const parsed = exerciseOutputSchema.parse(JSON.parse(raw));

      // Keep the items that survive constraint checks; a couple of bad ones
      // shouldn't waste the whole batch on the free tier.
      const good: ExerciseData[] = [];
      const problems: string[] = [];
      for (const ex of parsed.exercises) {
        try {
          checkItem(ex);
          good.push(ex);
        } catch (e) {
          problems.push(e instanceof Error ? e.message : String(e));
        }
      }
      if (problems.length > 0) {
        console.log("Rejected exercises:", problems.join(" | "));
      }
      if (good.length < Math.max(2, Math.floor(req.count / 2))) {
        throw new Error(`Only ${good.length} valid exercises (${problems.slice(0, 3).join("; ")})`);
      }
      return good.slice(0, req.count);
    },
  });
}
