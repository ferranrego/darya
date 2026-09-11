/**
 * Checking that a text was actually understood.
 *
 * Until now nothing in the app checked comprehension at all. A learner could
 * scroll to the end of a text having understood none of it, collect the points
 * and get credit toward the next level. There is a `texts.questions` column,
 * added for a feature that was designed as an AI call on the first read of
 * every text - which the shared free-tier quota cannot afford - so it was
 * never written to and never read.
 *
 * Questions are content here, not generation. Hand-written where somebody has
 * written them, and derived from the text's own sentences everywhere else:
 * generated texts, imported articles, and every beginner text not yet
 * authored. Derived questions cost nothing and work on any text, which is the
 * only reason every text can be quizzed from the day this ships.
 */
import type { ComprehensionQuestion, TextDocument } from "./schema.ts";

/** Options per derived question: the answer plus this many wrong ones. */
const DERIVED_OPTIONS = 3;
/** Below this a text has too few sentences to draw wrong options from. */
const MIN_SENTENCES_TO_DERIVE = 4;
/** What a reader is asked, at most, about one text. */
export const MAX_QUESTIONS = 3;

/**
 * The one thing a derived question asks.
 *
 * Authored once, in both languages, because a derived question still has to
 * obey the level rule below - a learner above the beginner levels sees the
 * Dari prompt alone. Written by hand like every other piece of Dari in the
 * repo; a generated prompt is one nobody has read.
 */
const DERIVED_PROMPT = {
  en: "Which sentence says this?",
  target: "کدام جمله این را می‌گوید؟",
  translit: "kudām jumla īn rā mēgōyad?",
} as const;

/**
 * Which language a question is shown in, by level.
 *
 * A true beginner cannot read a Dari question about a Dari text: the question
 * becomes the test instead of the text, and a wrong answer then means "misread
 * the question", which is useless as evidence when Phase 7 uses these scores
 * for promotion. So the first two levels show both, with the Dari there as
 * exposure and the English carrying the check. Above that the Dari stands
 * alone, which is the point of the whole course.
 */
export function questionDisplay(level: string): { en: boolean; target: boolean } {
  const beginner = level === "L1" || level === "L2";
  return { en: beginner, target: true };
}

/** Rotate a list deterministically, so callers can reproduce a quiz in a test. */
function pick<T>(items: readonly T[], n: number, rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

/**
 * Build questions from a text's own sentences, with no model call.
 *
 * The question gives one sentence's English meaning and asks which Dari
 * sentence says it; the wrong options are other sentences from the same text.
 * That tests who-did-what rather than spotting a word, because every option is
 * made of vocabulary from the same text and looks equally plausible.
 *
 * Returns `[]` rather than a weak quiz when a text is too short: three
 * sentences cannot supply an answer and three convincing wrong options, and a
 * question whose options are obviously padding teaches a learner to guess.
 */
export function deriveQuestions(
  doc: Pick<TextDocument, "sentences">,
  rand: () => number,
  max = MAX_QUESTIONS,
): ComprehensionQuestion[] {
  // An imported article translates its first few sentences eagerly and the
  // rest on demand, so an untranslated sentence is a normal state there. A
  // question built on an empty English meaning asks nothing.
  const sentences = doc.sentences.filter((s) => s.en.trim().length > 0);
  if (sentences.length < MIN_SENTENCES_TO_DERIVE) return [];

  // Two sentences that translate the same way would make a question with two
  // right answers, so an English meaning is only usable once.
  const seenEn = new Set<string>();
  const usable = sentences
    // Index into the document's own sentence list: `evidenceSentence` points
    // the learner back at the line that proves the answer, and an index into a
    // filtered copy would point at the wrong one.
    .map((s) => ({ s, index: doc.sentences.indexOf(s) }))
    .filter(({ s }) => {
      const key = s.en.trim().toLowerCase();
      if (seenEn.has(key)) return false;
      seenEn.add(key);
      return true;
    });
  if (usable.length < MIN_SENTENCES_TO_DERIVE) return [];

  const out: ComprehensionQuestion[] = [];
  for (const { s, index } of pick(usable, max, rand)) {
    const others = usable.filter((o) => o.index !== index);
    const wrong = pick(others, DERIVED_OPTIONS, rand);
    if (wrong.length < DERIVED_OPTIONS) break;

    const options = pick(
      [s, ...wrong.map((o) => o.s)].map((o) => ({
        en: o.en,
        target: o.target,
        translit: o.translit,
      })),
      DERIVED_OPTIONS + 1,
      rand,
    );
    const answerIndex = options.findIndex((o) => o.target === s.target);
    // A shuffle that somehow lost the answer would make an unanswerable
    // question; drop it rather than ship one.
    if (answerIndex < 0) continue;

    out.push({
      questionEn: `${DERIVED_PROMPT.en} "${s.en}"`,
      questionTarget: DERIVED_PROMPT.target,
      questionTranslit: DERIVED_PROMPT.translit,
      options,
      answerIndex,
      evidenceSentence: index,
      source: "derived",
    });
  }
  return out;
}

/**
 * The questions to ask about a text.
 *
 * Hand-written ones win wherever they exist - they can ask about the meaning
 * of the whole text, which nothing mechanical can - and derived ones fill in
 * behind them so no text goes unquizzed while the authoring is unfinished.
 */
export function questionsFor(
  doc: Pick<TextDocument, "sentences"> & { questions?: ComprehensionQuestion[] },
  rand: () => number,
  max = MAX_QUESTIONS,
): ComprehensionQuestion[] {
  const authored = (doc.questions ?? []).slice(0, max);
  if (authored.length >= max) return authored;
  const derived = deriveQuestions(doc, rand, max - authored.length);
  return [...authored, ...derived];
}

/** One question the learner did not get right. */
export interface MissedQuestion {
  /** Index into the question list. */
  index: number;
  /** The option they picked, or null if they never answered. */
  chosen: number | null;
}

/** A finished quiz: what they scored, and which questions they missed. */
export interface QuizResult {
  correct: number;
  total: number;
  /**
   * What they got wrong and what they picked instead. The wrong option is the
   * useful half: "chose the sentence about the brother when it was about the
   * sister" is teachable, and "got question 2 wrong" is not.
   */
  missed: MissedQuestion[];
  /** Fraction right, 0 when there was nothing to ask. */
  score: number;
}

/**
 * Score a set of answers. Pure, so promotion can be reasoned about in a test.
 *
 * An unanswered question counts as wrong: a learner who skips the check has
 * not demonstrated comprehension, and treating skips as absent would let the
 * score be gamed by answering only the easy ones.
 */
export function scoreQuiz(
  questions: readonly ComprehensionQuestion[],
  answers: readonly (number | null)[],
): QuizResult {
  const missed: MissedQuestion[] = [];
  let correct = 0;
  questions.forEach((q, i) => {
    if (answers[i] === q.answerIndex) correct += 1;
    else missed.push({ index: i, chosen: answers[i] ?? null });
  });
  return {
    correct,
    total: questions.length,
    missed,
    score: questions.length === 0 ? 0 : correct / questions.length,
  };
}
