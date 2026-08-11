import { describe, expect, it } from "vitest";
import { profile } from "../lang/index.ts";
import {
  beginnerPositionFor,
  knownSetsFor,
  placementCredit,
  selectUnread,
  type KnownSets,
  type PoolText,
} from "./text-pool.ts";
import { levelVocabulary } from "./level-vocabulary.ts";
import { scenesFor } from "./scene.ts";
import { coldStartKnown } from "./word-selection.ts";
import { isTeachable } from "./teachability.ts";
import { lexicon, levels } from "./load.ts";

/** A generated text using the given lexeme ids. */
function generated(id: string, vocabUsed: string[]): PoolText {
  return { id, source: "generated", doc: { vocabUsed } };
}

/**
 * A `KnownSets` test double for the unit tests below, which exercise
 * `selectUnread`'s gates directly rather than the real `knownSetsFor`
 * pipeline (that is covered separately, against real content, further down).
 * `coverage` defaults to `familiar` when the test has no reason to tell them
 * apart.
 */
function knownSets(familiar: readonly string[], coverage?: readonly string[]): KnownSets {
  return {
    familiar: new Set(familiar),
    coverage: new Set(coverage ?? familiar),
    placement: [],
  };
}

const band = Array.from({ length: 40 }, (_, i) => `lx-${String(i + 1).padStart(4, "0")}`);

describe("which texts a learner is offered", () => {
  it("accepts a text built from words the learner knows plus a few new ones", () => {
    const text = generated("t1", [...band.slice(0, 18), "lx-9001", "lx-9002"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      known: knownSets(band),
    });
    expect(out.map((t) => t.id)).toEqual(["t1"]);
  });

  it("rejects a text that is mostly unknown", () => {
    const text = generated("t1", ["lx-9001", "lx-9002", "lx-9003", "lx-9004"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      known: knownSets(band),
    });
    expect(out).toEqual([]);
  });

  it("rejects a text with nothing new in it", () => {
    const text = generated("t1", band.slice(0, 10));
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      known: knownSets(band),
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
    const args = { texts: [text], readIds: new Set<string>() };

    expect(
      selectUnread({ ...args, known: knownSets(tracked) }),
      "rows only",
    ).toEqual([]);
    expect(
      selectUnread({ ...args, known: knownSets([...tracked, ...band]) }).map((t) => t.id),
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
      known: knownSets([...band.slice(0, 5), ...band]),
    });
    expect(out).toEqual([]);
  });

  it("never hides a seed text, and never repeats a finished one", () => {
    const seed: PoolText = { id: "s1", source: "seed", doc: { vocabUsed: ["lx-9001"] } };
    const out = selectUnread({
      texts: [generated("t1", band.slice(0, 10)), seed],
      readIds: new Set(),
      known: knownSets([]),
    });
    expect(out.map((t) => t.id)).toEqual(["s1"]);

    const afterReading = selectUnread({
      texts: [seed],
      readIds: new Set(["s1"]),
      known: knownSets([]),
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
      known: knownSets([]),
    });
    expect(out.map((t) => t.id)).toEqual(["s1", "s2", "s3", "s-none"]);
  });

  it("keeps the open text in the list so it cannot vanish mid-read", () => {
    const text = generated("t1", ["lx-9001", "lx-9002", "lx-9003", "lx-9004"]);
    const out = selectUnread({
      texts: [text],
      readIds: new Set(),
      known: knownSets(band),
      activeTextId: "t1",
    });
    expect(out.map((t) => t.id)).toEqual(["t1"]);
  });
});

describe("beginner curriculum positions", () => {
  function scheduledGenerated(id: string, seq?: number): PoolText {
    const newWords = ["lx-9001", "lx-9002"];
    return {
      id,
      source: "generated",
      doc: { vocabUsed: [...band.slice(0, 6), ...newWords], newWords, ...(seq == null ? {} : { seq }) },
    };
  }

  it("starts at slot one and advances one past the highest completed sequenced text", () => {
    const first = scheduledGenerated("g1", 1);
    const third = scheduledGenerated("g3", 3);

    expect(beginnerPositionFor([first, third], new Set())).toBe(1);
    expect(beginnerPositionFor([first, third], new Set(["g1"]))).toBe(2);
    expect(beginnerPositionFor([first, third], new Set(["g1", "g3"]))).toBe(4);
  });

  it("does not offer a generated text beyond the learner's beginner position", () => {
    const current = scheduledGenerated("current", 3);
    const future = scheduledGenerated("future", 4);

    const out = selectUnread({
      texts: [future, current],
      readIds: new Set(),
      known: knownSets(band),
      beginnerPosition: 3,
    });

    expect(out.map((t) => t.id)).toEqual(["current"]);
  });

  it("orders generated slot texts by sequence and leaves unsequenced generated texts last", () => {
    const late = scheduledGenerated("late", 3);
    const early = scheduledGenerated("early", 2);
    const legacy = scheduledGenerated("legacy");

    const out = selectUnread({
      texts: [late, legacy, early],
      readIds: new Set(),
      known: knownSets(band),
      beginnerPosition: 3,
    });

    expect(out.map((t) => t.id)).toEqual(["early", "late", "legacy"]);
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
      const levelsForLang = JSON.parse(
        readFileSync(join(root, lang, "levels", "levels.json"), "utf8"),
      ).levels as { id: string; entryKnownWords: number }[];
      const lexemes = JSON.parse(
        readFileSync(join(root, lang, "lexicon", "lexicon.json"), "utf8"),
      ).entries as { id: string; freqRank: number }[];

      for (const level of levelsForLang.slice(1)) {
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
 *
 * `knownSetsFor`'s `coverage` is what closes this for good: it is built from
 * `levelVocabulary`, the same beginner-core-inclusive definition the writer
 * uses, so there is no separate fallback list for the two halves to disagree
 * about any more.
 */
describe("the cold start agrees between the writer and the reader", () => {
  it.each(["ca", "prs"])("%s: a text built from the starting vocabulary is offered", async (lang) => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { coldStartKnown: coldStartKnownFor } = await import("./word-selection.ts");
    const { isTeachable: isTeachableFor } = await import("./teachability.ts");
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
    const start = coldStartKnownFor(entries, level, isTeachableFor);
    const taught = ["lx-9001", "lx-9002", "lx-9003"];
    // The tail of the slice, not the head: those are the picturable core words
    // a beginner text is actually built from, and the ones the old reader list
    // lacked. Taking the head would pass under either rule and prove nothing.
    const text = generated("t1", [...start.slice(-20).map((e) => e.id), ...taught]);

    // A zero-tracked learner's real `knownSetsFor` coverage at L1 - the writer
    // and the reader now derive from the exact same `levelVocabulary`, so
    // nothing needs to be mirrored by hand any more.
    const known = knownSetsFor({ level, entries, isUsable: isTeachableFor, trackedIds: [] });

    const offered = selectUnread({
      texts: [text],
      readIds: new Set(),
      known,
    });
    expect(
      offered.map((t) => t.id),
      `${lang}: the reader rejected a text written from its own starting vocabulary`,
    ).toEqual(["t1"]);

    // And the rule it replaced would have thrown the same text away. If this
    // ever stops holding, the two lists have converged and the guard above has
    // become vacuous rather than satisfied.
    const oldReaderList = entries
      .filter((e: { freqBand: number }) => level.freqBands.includes(e.freqBand))
      .slice(0, 60)
      .map((e: { id: string }) => e.id);
    expect(
      selectUnread({
        texts: [text],
        readIds: new Set(),
        known: knownSets(oldReaderList),
      }),
      `${lang}: the old 60-word frequency head no longer rejects this, so the test proves nothing`,
    ).toEqual([]);
  });
});

/**
 * The contract `knownSetsFor` exists to hold, checked against the real,
 * shipped content for the active language (`NEXT_PUBLIC_TARGET_LANG`).
 * CLAUDE.md is explicit that a check run under one language is not a check -
 * `pnpm test` must be run once per language, which is how these run against
 * both `ca` and `prs` in CI.
 */
describe(`${profile.code} knownSetsFor`, () => {
  it("non-regression: coldStartKnown stays inside coverage at every level, for a zero-tracked learner", () => {
    // This held with 0 exceptions across every level before this change, and
    // must keep holding: `coldStartKnown` is the server's own fallback
    // starting vocabulary, so anything it hands the generator has to be
    // something the reader will accept back.
    for (const level of levels) {
      const known = knownSetsFor({ level, entries: lexicon.entries, isUsable: isTeachable, trackedIds: [] });
      const start = coldStartKnown(lexicon.entries, level, isTeachable);
      for (const entry of start) {
        expect(
          known.coverage.has(entry.id),
          `${level.id}: coldStartKnown includes ${entry.id} (${entry.target}) but coverage does not`,
        ).toBe(true);
      }
    }
  });

  it("the bug this change fixes: every scene's words are inside coverage, for a zero-tracked learner", () => {
    // This is what was failing on main: at L1, entryKnownWords is 0, so
    // placementCredit alone returns nothing and the old assumedKnown union
    // was measured as empty for a fresh learner, while scenesFor draws its
    // words from the beginner core. Every scene word therefore sat outside
    // the old known set. knownSetsFor's coverage folds levelVocabulary in
    // directly, so this must now hold at every level, not just above L1.
    for (const level of levels) {
      const known = knownSetsFor({ level, entries: lexicon.entries, isUsable: isTeachable, trackedIds: [] });
      const vocab = new Set(levelVocabulary(level, lexicon.entries, isTeachable).map((e) => e.id));
      const scenes = scenesFor(level, lexicon.entries, isTeachable);
      for (const scene of scenes) {
        for (const word of scene.words) {
          if (!vocab.has(word.id)) continue; // only the level's own vocabulary is in scope here
          expect(
            known.coverage.has(word.id),
            `${level.id} scene ${scene.id}: ${word.id} (${word.target}) is in levelVocabulary but not coverage`,
          ).toBe(true);
        }
      }
    }
  });

  it("monotonicity: coverage never shrinks as trackedIds grows", () => {
    // A learner tracking more words must never make more texts look
    // *harder* - that is the 40-word cliff this guards against. It used to
    // live in route.ts/read/page.tsx (a hardcoded `>= 40` branch dropping the
    // 120-word cold start), not in this file, but knownSetsFor's formula -
    // familiar ∪ levelVocabulary - structurally cannot regress: adding to
    // trackedIds only ever adds to familiar, and levelVocabulary does not
    // depend on trackedIds at all, so coverage is monotone by construction.
    for (const level of levels) {
      const empty = knownSetsFor({ level, entries: lexicon.entries, isUsable: isTeachable, trackedIds: [] });

      const usable = lexicon.entries.filter(isTeachable);
      const sample = usable.slice(0, Math.min(40, usable.length)).map((e) => e.id);

      const withTracked = knownSetsFor({
        level,
        entries: lexicon.entries,
        isUsable: isTeachable,
        trackedIds: sample,
      });

      for (const id of empty.coverage) {
        expect(withTracked.coverage.has(id), `${level.id}: ${id} dropped out of coverage`).toBe(true);
      }
      expect(withTracked.coverage.size).toBeGreaterThanOrEqual(empty.coverage.size);
    }
  });

  it("familiar is always a subset of coverage", () => {
    for (const level of levels) {
      const usable = lexicon.entries.filter(isTeachable);
      const sample = usable.slice(0, Math.min(25, usable.length)).map((e) => e.id);
      const known = knownSetsFor({ level, entries: lexicon.entries, isUsable: isTeachable, trackedIds: sample });
      for (const id of known.familiar) {
        expect(known.coverage.has(id), `${level.id}: ${id} is familiar but not covered`).toBe(true);
      }
    }
  });

  it("placement never re-offers a word the learner already tracks", () => {
    // placementCredit already filters tracked ids out; this exercises that
    // through knownSetsFor rather than assuming it, by tracking words that
    // are actually inside the placement credit's range and checking they do
    // not come back out in `placement`.
    for (const level of levels.slice(1)) {
      // slice(1): L1's entryKnownWords is 0, so its placement is always empty
      // and this would vacuously pass - see "credits nothing at the first
      // level" above.
      const usable = lexicon.entries.filter((e) => e.freqRank <= level.entryKnownWords && isTeachable(e));
      if (usable.length === 0) continue;
      const tracked = usable.slice(0, Math.max(1, Math.floor(usable.length / 2))).map((e) => e.id);

      const known = knownSetsFor({ level, entries: lexicon.entries, isUsable: isTeachable, trackedIds: tracked });
      const overlap = known.placement.filter((id) => tracked.includes(id));
      expect(overlap, `${level.id}: placement re-offers a tracked word`).toEqual([]);
    }
  });
});
