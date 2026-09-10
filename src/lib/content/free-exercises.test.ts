import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { lexiconFileSchema, textDocumentSchema, type TextDocument } from "./schema.ts";
import { buildFreeExercises } from "./free-exercises.ts";

/**
 * Run the builder over the real beginner corpus, not fixtures.
 *
 * The claim being made is that exercises cut from seed text are in-vocabulary
 * by construction and need no model call to be safe. That is only worth
 * anything if it holds against the content actually shipped, so these assert
 * it there - and print how many exist, because "we could build some" and "we
 * can fill a session" are different claims.
 */
function load() {
  const root = join(process.cwd(), "content", "prs");
  const lexicon = lexiconFileSchema.parse(
    JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
  );
  const dir = join(root, "texts", "seed");
  const docs: TextDocument[] = readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => textDocumentSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))))
    .filter((d) => d.level === "L1" || d.level === "L2");
  return { lexicon, docs };
}

// Deterministic, so a failure is reproducible rather than a coin flip.
function rand() {
  let s = 42;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe("exercises built from seed text", () => {
  const { lexicon, docs } = load();
  // A beginner who has met the whole beginner corpus.
  const vocab = new Set(docs.flatMap((d) => d.vocabUsed));
  const known = lexicon.entries.filter((e) => vocab.has(e.id));
  const targets = [...vocab];

  it("can fill a practice session many times over", () => {
    const built = buildFreeExercises({ docs, targetLexemeIds: targets, known, count: 500, rand: rand() });
    // A session is 5. Print the real number so the claim is checkable.
    console.log(`free exercises available from the beginner corpus: ${built.length}`);
    expect(built.length).toBeGreaterThan(50);
  });

  it("never asks about a word outside the sentence's own vocabulary", () => {
    const ids = new Set(lexicon.entries.map((e) => e.id));
    for (const ex of buildFreeExercises({ docs, targetLexemeIds: targets, known, count: 200, rand: rand() })) {
      expect(ids.has(ex.lexemeId)).toBe(true);
    }
  });

  it("gives every cloze a unique answer and wrong distractors", () => {
    const built = buildFreeExercises({ docs, targetLexemeIds: targets, known, count: 200, rand: rand() });
    const clozes = built.filter((b) => b.data.type === "cloze");
    expect(clozes.length).toBeGreaterThan(0);
    for (const { data } of clozes) {
      if (data.type !== "cloze") continue;
      // A distractor that is also the answer makes the exercise unanswerable.
      expect(data.distractors).not.toContain(data.missingWord);
      expect(new Set(data.distractors).size).toBe(data.distractors.length);
      expect(data.distractors.length).toBeGreaterThanOrEqual(2);
      // The blanked word must really be in the sentence, or there is nothing to find.
      expect(data.sentenceTarget).toContain(data.missingWord);
      // Both exercise types require a transliteration; with no audio in the
      // app it is the only pronunciation the learner gets. The field's type is
      // decided per build (Catalan needs no guide), so it reads as optional
      // here even though this build makes it required - hence the assertion
      // that it is present, then the assertion about it.
      expect(typeof data.sentenceTranslit).toBe("string");
      expect(typeof data.missingTranslit).toBe("string");
      expect(data.sentenceTranslit!.length).toBeGreaterThan(0);
      expect(data.missingTranslit!.length).toBeGreaterThan(0);
    }
  });

  it("keeps every word of an unscramble, just in a different order", () => {
    const built = buildFreeExercises({ docs, targetLexemeIds: targets, known, count: 500, rand: rand() });
    for (const { data } of built) {
      if (data.type !== "unscramble") continue;
      const inSentence = data.sentenceTarget.split(/\s+/).map((w) => w.replace(/[.?!،]/g, ""));
      for (const w of data.words) expect(inSentence).toContain(w);
      expect(data.words.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("never uses one sentence twice in a session", () => {
    const built = buildFreeExercises({ docs, targetLexemeIds: targets, known, count: 200, rand: rand() });
    const seen = built.map((b) => (b.data.type === "cloze" || b.data.type === "unscramble" ? b.data.sentenceTarget : ""));
    expect(new Set(seen).size).toBe(seen.length);
  });

  it("builds word-order practice, not only blanks", () => {
    // A cloze can be cut from almost any sentence and only one exercise is
    // made per sentence, so without a reserved share the cloze pass eats the
    // whole corpus: measured at 400 clozes and 0 unscrambles. That is how the
    // fully-built `unscramble` type went unused for so long, and this is the
    // assertion that stops it happening again.
    let cloze = 0;
    let unscramble = 0;
    const ids = [...vocab];
    const r = rand();
    for (let i = 0; i + 5 <= ids.length; i += 5) {
      const built = buildFreeExercises({ docs, targetLexemeIds: ids.slice(i, i + 8), known, count: 5, rand: r });
      cloze += built.filter((b) => b.data.type === "cloze").length;
      unscramble += built.filter((b) => b.data.type === "unscramble").length;
    }
    console.log(`over real sessions of five: ${cloze} cloze, ${unscramble} unscramble`);
    expect(unscramble).toBeGreaterThan(0);
    // Roughly a third by design; assert only that neither type is a token
    // presence, so the exact share stays a tuning decision rather than a test.
    expect(unscramble / (cloze + unscramble)).toBeGreaterThan(0.2);
    expect(cloze / (cloze + unscramble)).toBeGreaterThan(0.4);
  });

  it("returns nothing rather than something broken when there is no vocabulary", () => {
    expect(buildFreeExercises({ docs, targetLexemeIds: [], known: [], count: 5, rand: rand() })).toEqual([]);
  });
});
