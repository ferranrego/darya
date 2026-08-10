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

  it("orders seed texts by curriculum seq, missing seq last", () => {
    // The corpus is a curriculum, not a pile - see build-seed-texts.ts. A
    // learner reads a level's seed texts in the order they were written to
    // introduce vocabulary, not in whatever order they were cached.
    const seedNoSeq: PoolText = { id: "s-none", source: "seed", doc: { vocabUsed: ["lx-9001"] } };
    const seed3: PoolText = { id: "s3", source: "seed", doc: { vocabUsed: ["lx-9001"], seq: 3 } };
    const seed1: PoolText = { id: "s1", source: "seed", doc: { vocabUsed: ["lx-9001"], seq: 1 } };
    const seed2: PoolText = { id: "s2", source: "seed", doc: { vocabUsed: ["lx-9001"], seq: 2 } };
    const out = selectUnread({
      texts: [seed3, seedNoSeq, seed1, seed2],
      readIds: new Set(),
      trackedIds: [],
      priorIds: [],
    });
    expect(out.map((t) => t.id)).toEqual(["s1", "s2", "s3", "s-none"]);
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

/**
 * The cold start, which is the same contract failing a third time.
 *
 * A learner on their first visit has no tracked words and, at L1, no placement
 * credit either - `entryKnownWords` is 0 - so both halves fall back to an
 * assumed starting vocabulary. They fell back to *different* ones: the route
 * used `coldStartKnown` (120 entries, beginner core first, teachability
 * filtered) while the reader used `lexicon.entries.filter(inBand).slice(0, 60)`
 * (60 entries, file order, unfiltered). Measured on the shipped lexicons, only
 * 56 of 60 (ca) and 60 of 60 (prs) overlapped, so 64 and 60 of the words the
 * server had *built the text out of* were scored here as untaught difficulty.
 *
 * The failure was silent and total: `/api/generate` answered `created: true`,
 * `selectUnread` returned nothing, and after three rounds the learner was told
 * the texts were the wrong level for them.
 *
 * It was also self-aggravating, which is the part worth remembering. The
 * beginner core exists precisely because `gos` and `poma` rank far below the
 * frequency head - so every core word the generator correctly reached for was a
 * word the reader's list did not have. Improving the content made the reader
 * reject more of it.
 */
describe("the cold start agrees between the writer and the reader", () => {
  it.each(["ca", "prs"])("%s: a text built from the starting vocabulary is offered", async (lang) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { coldStartKnown } = await import("./word-selection.ts");
    const { isTeachable } = await import("./teachability.ts");
    const { lexiconFileSchema, levelsFileSchema } = await import("./schema.ts");

    const root = join(import.meta.dirname, "..", "..", "..", "content", lang);
    const entries = lexiconFileSchema.parse(
      JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
    ).entries;
    const level = levelsFileSchema.parse(
      JSON.parse(readFileSync(join(root, "levels", "levels.json"), "utf8")),
    ).levels[0];

    // What the server writes against, and what it teaches: words from the same
    // starting vocabulary plus a handful of new ones it declares.
    const start = coldStartKnown(entries, level, isTeachable);
    const taught = ["lx-9001", "lx-9002", "lx-9003"];
    // The tail of the slice, not the head: those are the picturable core words
    // a beginner text is actually built from, and the ones the old reader list
    // lacked. Taking the head would pass under either rule and prove nothing.
    const text = generated("t1", [...start.slice(-20).map((e) => e.id), ...taught]);

    const offered = selectUnread({
      texts: [text],
      readIds: new Set(),
      trackedIds: [],
      priorIds: [],
      fallbackIds: start.map((e) => e.id),
    });
    expect(
      offered.map((t) => t.id),
      `${lang}: the reader rejected a text written from its own starting vocabulary`,
    ).toEqual(["t1"]);

    // And the rule it replaced would have thrown the same text away. If this
    // ever stops holding, the two lists have converged and the guard above has
    // become vacuous rather than satisfied.
    const oldReaderList = entries
      .filter((e) => level.freqBands.includes(e.freqBand))
      .slice(0, 60)
      .map((e) => e.id);
    expect(
      selectUnread({
        texts: [text],
        readIds: new Set(),
        trackedIds: [],
        priorIds: [],
        fallbackIds: oldReaderList,
      }),
      `${lang}: the old 60-word frequency head no longer rejects this, so the test proves nothing`,
    ).toEqual([]);
  });
});
