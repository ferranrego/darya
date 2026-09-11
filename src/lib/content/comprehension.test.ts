import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { deriveQuestions, questionDisplay, questionsFor, scoreQuiz } from "./comprehension.ts";
import { textDocumentSchema, type TextDocument } from "./schema.ts";

/**
 * Derived questions are run against the real corpus, not fixtures.
 *
 * The claim is that every text can be quizzed from the day this ships, without
 * a model call and without waiting for the authoring to finish. That is only
 * worth anything if it holds against the texts actually shipped - and it
 * prints how many texts are covered, because "it can build some" and "no text
 * goes unquizzed" are different claims.
 */
function seedDocs(): TextDocument[] {
  const dir = join(process.cwd(), "content", "prs", "texts", "seed");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => textDocumentSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))));
}

// Deterministic, so a failure is reproducible rather than a coin flip.
function rand() {
  let s = 7;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("comprehension questions derived from a text", () => {
  const docs = seedDocs();

  it("covers the texts the app actually ships", () => {
    const covered = docs.filter((d) => questionsFor(d, rand()).length > 0);
    const short = docs.length - covered.length;
    console.log(`texts with questions: ${covered.length} of ${docs.length} (${short} too short to derive from)`);
    // Every text long enough to draw options from must be quizzable.
    for (const doc of docs) {
      if (doc.sentences.length >= 4) {
        expect(questionsFor(doc, rand()).length, doc.id).toBeGreaterThan(0);
      }
    }
  });

  it("marks exactly one option right, and it is really the answer", () => {
    for (const doc of docs) {
      for (const q of deriveQuestions(doc, rand())) {
        expect(q.options[q.answerIndex], doc.id).toBeDefined();
        // The right option must be the sentence the question quoted; the quiz
        // is unanswerable otherwise, and silently so.
        expect(q.questionEn, doc.id).toContain(q.options[q.answerIndex].en);
        // No other option may say the same thing in English, or there are two
        // right answers and the learner is marked wrong for finding one.
        const same = q.options.filter((o) => o.en === q.options[q.answerIndex].en);
        expect(same.length, `${doc.id}: ${q.questionEn}`).toBe(1);
      }
    }
  });

  it("points at the sentence that proves the answer", () => {
    for (const doc of docs) {
      for (const q of deriveQuestions(doc, rand())) {
        const evidence = doc.sentences[q.evidenceSentence];
        expect(evidence, doc.id).toBeDefined();
        expect(evidence.target).toBe(q.options[q.answerIndex].target);
      }
    }
  });

  it("gives every question four options to choose between", () => {
    for (const doc of docs) {
      for (const q of deriveQuestions(doc, rand())) {
        expect(q.options.length, doc.id).toBe(4);
        expect(new Set(q.options.map((o) => o.target)).size, doc.id).toBe(4);
      }
    }
  });

  it("asks nothing rather than something guessable about a very short text", () => {
    const tiny = { sentences: seedDocs()[0].sentences.slice(0, 3) };
    expect(deriveQuestions(tiny, rand())).toEqual([]);
  });
});

describe("which language the question is shown in", () => {
  it("shows a beginner both, so the question is not itself the test", () => {
    expect(questionDisplay("L1")).toEqual({ en: true, target: true });
    expect(questionDisplay("L2")).toEqual({ en: true, target: true });
  });

  it("lets the Dari stand alone above the beginner levels", () => {
    for (const level of ["L3", "L4", "L5"]) {
      expect(questionDisplay(level), level).toEqual({ en: false, target: true });
    }
  });

  it("always carries the Dari, at every level", () => {
    for (const level of ["L1", "L2", "L3", "L4", "L5"]) {
      expect(questionDisplay(level).target, level).toBe(true);
    }
  });
});

describe("scoring a quiz", () => {
  const doc = seedDocs().find((d) => d.sentences.length >= 6)!;
  const questions = deriveQuestions(doc, rand());

  it("counts a skipped question as wrong", () => {
    // Otherwise the score is gamed by answering only the easy ones, and Phase
    // 7 promotes on it.
    const result = scoreQuiz(questions, questions.map(() => null));
    expect(result.correct).toBe(0);
    expect(result.missed).toHaveLength(questions.length);
    // A skip is recorded as a skip, not as a wrong choice.
    expect(result.missed.every((m) => m.chosen === null)).toBe(true);
    expect(result.score).toBe(0);
  });

  it("scores a perfect run at 1 and records nothing missed", () => {
    const result = scoreQuiz(questions, questions.map((q) => q.answerIndex));
    expect(result.correct).toBe(questions.length);
    expect(result.missed).toEqual([]);
    expect(result.score).toBe(1);
  });

  it("names which questions were missed, not just how many", () => {
    const answers = questions.map((q, i) => (i === 0 ? (q.answerIndex + 1) % q.options.length : q.answerIndex));
    const result = scoreQuiz(questions, answers);
    expect(result.missed).toEqual([{ index: 0, chosen: (questions[0].answerIndex + 1) % questions[0].options.length }]);
  });

  it("returns a zero score rather than dividing by nothing", () => {
    expect(scoreQuiz([], [])).toEqual({ correct: 0, total: 0, missed: [], score: 0 });
  });
});
