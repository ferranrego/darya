import { describe, expect, it } from "vitest";
import { placementCredit, selectUnread, type PoolText } from "./text-pool.ts";

/** A generated text using the given lexeme ids. */
function generated(id: string, vocabUsed: string[]): PoolText {
  return { id, source: "generated", doc: { vocabUsed } };
}

const band = Array.from({ length: 40 }, (_, i) => `lx-${String(i + 1).padStart(4, "0")}`);

describe("which texts a learner is offered", () => {
  it("accepts a text built from words the learner knows plus a few new ones", () => {
    const text = generated("t1", [...band.slice(0, 18), "lx-9001", "lx-9002"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band,
      priorIds: [],
    });
    expect(out.map((t) => t.id)).toEqual(["t1"]);
  });

  it("rejects a text that is mostly unknown", () => {
    const text = generated("t1", ["lx-9001", "lx-9002", "lx-9003", "lx-9004"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band,
      priorIds: [],
    });
    expect(out).toEqual([]);
  });

  it("rejects a text with nothing new in it", () => {
    const text = generated("t1", band.slice(0, 10));
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band,
      priorIds: [],
    });
    expect(out).toEqual([]);
  });

  it("counts the words the placement credits the learner with", () => {
    // The regression this file exists for. Being placed at A2 means the levels
    // below are already known, but only the handful of words the assessment
    // happened to show ever become rows. Measuring against the rows alone
    // rejects every text the generator wrote, the pool looks empty, and the
    // reader spins on "Writing your next text…" forever.
    // 5 rows, but the placement credits the whole band.
    const tracked = band.slice(0, 5);
    const text = generated("t1", [...band.slice(0, 18), "lx-9001", "lx-9002"]);
    const args = { texts: [text], readIds: new Set<string>(), trackedIds: tracked };

    expect(selectUnread({ ...args, priorIds: [] }), "rows only").toEqual([]);
    expect(
      selectUnread({ ...args, priorIds: band }).map((t) => t.id),
      "rows plus the placement",
    ).toEqual(["t1"]);
  });

  it("still rejects a text that is too hard for the placement", () => {
    // Crediting the prior levels must not turn into accepting anything: words
    // above the learner's level are still new.
    const text = generated("t1", ["lx-9001", "lx-9002", "lx-9003", "lx-9004"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band.slice(0, 5),
      priorIds: band,
    });
    expect(out).toEqual([]);
  });

  it("never hides a seed text, and never repeats a finished one", () => {
    const seed: PoolText = { id: "s1", source: "seed", doc: { vocabUsed: ["lx-9001"] } };
    const out = selectUnread({
      texts: [generated("t1", band.slice(0, 10)), seed],
      readIds: new Set(),
      trackedIds: [],
      priorIds: [],
    });
    expect(out.map((t) => t.id)).toEqual(["s1"]);

    const afterReading = selectUnread({
      texts: [seed],
      readIds: new Set(["s1"]),
      trackedIds: [],
      priorIds: [],
    });
    expect(afterReading).toEqual([]);
  });

  it("keeps the open text in the list so it cannot vanish mid-read", () => {
    const text = generated("t1", ["lx-9001", "lx-9002", "lx-9003", "lx-9004"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: band,
      priorIds: [],
      activeTextId: "t1",
    });
    expect(out.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("the placement credit, against the shipped levels", () => {
  /**
   * Twice now the reader has stranded a learner on "Writing your next text…"
   * because the vocabulary it measured a text against was smaller than the one
   * the generator wrote with. The first time the threshold was a magic number;
   * the second it was read off the wrong level, which gave an L2 learner
   * L1's entry figure of zero and rejected every text at a rate of 1.00.
   *
   * So this asserts the property that actually matters, against the real
   * levels file: at every level a learner can reach, the placement credits
   * them with something.
   */
  it("gives every level above the first a non-empty credit", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(import.meta.dirname, "..", "..", "..", "content");

    for (const lang of ["ca", "prs"]) {
      const levels = JSON.parse(
        readFileSync(join(root, lang, "levels", "levels.json"), "utf8"),
      ).levels as { id: string; entryKnownWords: number }[];
      const lexemes = JSON.parse(
        readFileSync(join(root, lang, "lexicon", "lexicon.json"), "utf8"),
      ).entries as { id: string; freqRank: number }[];

      for (const level of levels.slice(1)) {
        const credit = placementCredit(level.entryKnownWords, lexemes, []);
        expect(
          credit.length,
          `${lang} ${level.id}: entryKnownWords=${level.entryKnownWords} credits nothing`,
        ).toBeGreaterThan(0);
      }
    }
  });

  it("credits nothing at the first level, which lives on seed texts", async () => {
    // L1 entry is 0 by definition: a beginner is credited with no vocabulary,
    // and the hand-checked seed texts are what carry them, since those bypass
    // the difficulty rule entirely.
    expect(placementCredit(0, [{ id: "lx-0001", freqRank: 1 }], [])).toEqual([]);
  });

  it("does not re-offer a word the learner already tracks", () => {
    const lexemes = [
      { id: "lx-0001", freqRank: 1 },
      { id: "lx-0002", freqRank: 2 },
    ];
    expect(placementCredit(10, lexemes, ["lx-0001"])).toEqual(["lx-0002"]);
  });
});
