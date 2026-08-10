import { beforeEach, describe, expect, it, vi } from "vitest";

import { lexicon, levels } from "../content/load.ts";
import type { LexiconEntry } from "../content/schema.ts";

/**
 * The contract a generated text has to satisfy, tested against a stubbed
 * provider so it runs offline and deterministically.
 *
 * Two regressions live here, and both were invisible in production because the
 * text still read perfectly well:
 *
 *  1. Coverage was measured against the *prompt slice* rather than against what
 *     the learner knows. A B2 learner knows thousands of words but only a few
 *     hundred fit in the prompt, so every known word that did not fit counted
 *     as out-of-vocabulary and good texts were failed and then "repaired" into
 *     worse ones.
 *  2. Nothing checked that the text contained the words it was written to
 *     teach. Measured live, Dari used 0 of 5 requested words at B2.
 */

const canned = vi.hoisted(() => ({ sentences: [] as { target: string; en: string }[] }));

vi.mock("./providers.ts", () => ({
  // The chain shares one wall-clock deadline across the several calls a single
  // generation makes; these tests do not exercise timing, so it is far enough
  // out never to expire mid-test.
  deadlineIn: (ms: number) => Date.now() + ms,
  completeJson: vi.fn(
    async (prompt: string, opts: { validate: (raw: string, model: string) => unknown }) => {
      // The module makes two different kinds of call. A repair asks for a
      // `repairs` array; answering it with the text shape makes zod throw and
      // the failure looks like a generation bug rather than a stub gap.
      // An empty array is a model that declined to change anything.
      const isRepair = prompt.includes('"repairs"');
      const body = isRepair
        ? { repairs: [] }
        : {
            titleTarget: canned.sentences[0]?.target ?? "x",
            titleTranslit: "x",
            titleEn: "Title",
            sentences: canned.sentences.map((s) => ({ ...s, translit: "x" })),
          };
      return opts.validate(JSON.stringify(body), "stub");
    },
  ),
}));

const { generateText } = await import("./generate.ts");

/** Pick entries whose surface tokenizes to exactly itself, so the stub text is predictable. */
function pickWords(n: number, from = 0): LexiconEntry[] {
  return lexicon.entries
    .filter((e) => !/\s/.test(e.target))
    .slice(from, from + n);
}

describe("generation contract", () => {
  const level = levels[1];

  beforeEach(() => {
    canned.sentences = [];
  });

  it("counts a word the learner knows as known even when it was not in the prompt", async () => {
    const inPrompt = pickWords(20);
    const knownButNotShown = pickWords(10, 40);
    const targets = pickWords(2, 80);

    // A text built only from words the learner knows - but half of them were
    // never shown to the model. Before the split, those counted as OOV and the
    // text was rejected as too hard for its own reader.
    canned.sentences = [
      { target: [...inPrompt.slice(0, 3), ...knownButNotShown.slice(0, 3)].map((e) => e.target).join(" "), en: "a" },
      { target: [...targets, ...inPrompt.slice(3, 5)].map((e) => e.target).join(" "), en: "b" },
      { target: knownButNotShown.slice(3, 7).map((e) => e.target).join(" "), en: "c" },
      { target: inPrompt.slice(5, 9).map((e) => e.target).join(" "), en: "d" },
    ];

    const doc = await generateText({
      level,
      knownWords: inPrompt,
      knownIds: new Set([...inPrompt, ...knownButNotShown].map((e) => e.id)),
      targetWords: targets,
      newWordRatio: 0.05,
    });

    expect(doc.newWords.sort()).toEqual(targets.map((t) => t.id).sort());
  });

  it("records only the target words the text actually contains", async () => {
    const known = pickWords(20);
    const targets = pickWords(4, 80);

    canned.sentences = [
      { target: [...known.slice(0, 2), targets[0], targets[1]].map((e) => e.target).join(" "), en: "a" },
      { target: [...known.slice(2, 4), targets[2], targets[3]].map((e) => e.target).join(" "), en: "b" },
      { target: known.slice(4, 8).map((e) => e.target).join(" "), en: "c" },
      { target: known.slice(8, 12).map((e) => e.target).join(" "), en: "d" },
    ];

    const doc = await generateText({
      level,
      knownWords: known,
      knownIds: new Set(known.map((e) => e.id)),
      targetWords: targets,
      newWordRatio: 0.05,
    });

    // All four must be used because MIN_TARGET_USE is now 1.0.
    expect(doc.newWords).toEqual([targets[0].id, targets[1].id, targets[2].id, targets[3].id].sort());
  });

  it("refuses a text that teaches nothing", async () => {
    const known = pickWords(20);
    const targets = pickWords(4, 80);

    // Fluent, entirely within the learner's vocabulary, and useless: it
    // contains none of the words it was written for. This is the text that
    // emptied the pool and made the reader regenerate forever.
    canned.sentences = [
      { target: known.slice(0, 4).map((e) => e.target).join(" "), en: "a" },
      { target: known.slice(4, 8).map((e) => e.target).join(" "), en: "b" },
      { target: known.slice(8, 12).map((e) => e.target).join(" "), en: "c" },
      { target: known.slice(12, 16).map((e) => e.target).join(" "), en: "d" },
    ];

    await expect(
      generateText({
        level,
        knownWords: known,
        knownIds: new Set(known.map((e) => e.id)),
        targetWords: targets,
        newWordRatio: 0.05,
      }),
    ).rejects.toThrow(/teaches 0 of 4/);
  });

  /**
   * The third regression, and the one that produced the reported nonsense.
   *
   * `outputSchema` requires two sentences and says nothing about their length,
   * so a pre-A1 text of two thirty-word sentences satisfied every gate in the
   * pipeline - coverage, grammar, targets - and was cached for every learner at
   * that level. The levels have always declared both numbers and nothing ever
   * read them.
   */
  it("refuses a text that is not the shape its level asked for", async () => {
    const known = pickWords(30);
    const targets = pickWords(4, 80);

    // Two sentences where the level wants four to six, and each one far past
    // its eight-word ceiling. Perfectly in-vocabulary, and unreadable at A1.
    canned.sentences = [
      { target: [...known.slice(0, 12), targets[0], targets[1]].map((e) => e.target).join(" "), en: "a" },
      { target: [...known.slice(12, 24), targets[2], targets[3]].map((e) => e.target).join(" "), en: "b" },
    ];

    await expect(
      generateText({
        level,
        knownWords: known,
        knownIds: new Set(known.map((e) => e.id)),
        targetWords: targets,
        newWordRatio: 0.05,
      }),
    ).rejects.toThrow(/sentences?, L2 asks for 4-6|over 8 words/);
  });
});
