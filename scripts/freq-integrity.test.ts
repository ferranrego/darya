import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { insertionOrderSuffix, parseFreqTsv, tsvRankDrift } from "./freq-integrity.ts";
import { lexiconFileSchema } from "../src/lib/content/schema.ts";
import type { LexiconEntry } from "../src/lib/content/schema.ts";

function entry(id: string, freqRank: number, freqBand = 5): LexiconEntry {
  return {
    id,
    target: id,
    targetNormalized: id,
    glossEn: "x",
    pos: "noun",
    freqRank,
    freqBand,
    register: "neutral",
    variants: [],
    exampleTarget: "x",
    exampleEn: "x",
    tags: [],
  } as LexiconEntry;
}

describe("insertionOrderSuffix", () => {
  it("finds nothing in a properly ranked lexicon", () => {
    // Ranks in a different order from ids, as real frequency ranking gives.
    const entries = [entry("lx-0001", 3), entry("lx-0002", 1), entry("lx-0003", 2)];
    expect(insertionOrderSuffix(entries)).toEqual([]);
  });

  it("ignores a short coincidental match", () => {
    // A handful of entries where rank happens to equal id - real at the head
    // of any lexicon, where authoring order and frequency order roughly agree.
    const entries = Array.from({ length: 10 }, (_, i) => entry(`lx-${String(i + 1).padStart(4, "0")}`, i + 1));
    expect(insertionOrderSuffix(entries)).toEqual([]);
  });

  it("catches a long unranked tail regardless of the offset", () => {
    const ranked = Array.from({ length: 30 }, (_, i) =>
      entry(`lx-${String(i + 1).padStart(4, "0")}`, 30 - i),
    );
    // Appended later, never frequency-ranked: freqRank = id + 1000, every one
    // of them, which is what "one past the current maximum" looks like.
    const unranked = Array.from({ length: 25 }, (_, i) => {
      const idn = 31 + i;
      return entry(`lx-${String(idn).padStart(4, "0")}`, idn + 1000, 10);
    });
    const result = insertionOrderSuffix([...ranked, ...unranked]);
    expect(result.map((e) => e.id)).toEqual(unranked.map((e) => e.id));
  });

  it("stops at the boundary where real ranking resumes", () => {
    const unranked = Array.from({ length: 25 }, (_, i) => {
      const idn = i + 1;
      return entry(`lx-${String(idn).padStart(4, "0")}`, idn + 1000, 10);
    });
    // One real entry appended after, whose rank does not follow the pattern.
    const real = entry("lx-0026", 4);
    expect(insertionOrderSuffix([...unranked, real])).toEqual([]);
  });
});

describe("tsvRankDrift", () => {
  it("finds nothing when the TSV and lexicon agree", () => {
    const entries = [entry("lx-0001", 1), entry("lx-0002", 2), entry("lx-0003", 3)];
    const tsv = [
      { lexemeId: "lx-0001", rank: 1 },
      { lexemeId: "lx-0002", rank: 2 },
      { lexemeId: "lx-0003", rank: 3 },
    ];
    expect(tsvRankDrift(entries, tsv, 50)).toEqual([]);
  });

  it("tolerates ordinary corpus-refresh noise", () => {
    // A handful of ranks nudged by a tie-break reorder - not evidence the two
    // files describe different rankings, just the same one measured twice.
    const entries = [entry("lx-0001", 10), entry("lx-0002", 20)];
    const tsv = [
      { lexemeId: "lx-0001", rank: 15 },
      { lexemeId: "lx-0002", rank: 25 },
    ];
    expect(tsvRankDrift(entries, tsv, 50)).toEqual([]);
  });

  it("flags a lexeme the TSV and lexicon rank far apart", () => {
    // The shape of the real defect this guards: a TSV committed from a run
    // that was never applied, so it is a proposal, not a record.
    const entries = [entry("lx-4265", 3622)];
    const tsv = [{ lexemeId: "lx-4265", rank: 623 }];
    const drift = tsvRankDrift(entries, tsv, 50);
    expect(drift).toEqual([{ lexemeId: "lx-4265", lexiconRank: 3622, tsvRank: 623 }]);
  });

  it("ignores a TSV row for an id no longer in the lexicon", () => {
    const entries = [entry("lx-0001", 1)];
    const tsv = [{ lexemeId: "lx-9999", rank: 500 }];
    expect(tsvRankDrift(entries, tsv, 50)).toEqual([]);
  });
});

describe("parseFreqTsv", () => {
  it("reads rank and lexemeId out of build-frequency.ts's column layout", () => {
    const raw = [
      "rank\tband\tlexemeId\ttarget\tpos\tblendedScore\tsubs\twiki",
      "1\t1\tlx-0030\tde\tpreposition\t2\t4\t1",
      "2\t1\tlx-0001\tel\tdeterminer\t3\t5\t2",
    ].join("\n");
    expect(parseFreqTsv(raw)).toEqual([
      { lexemeId: "lx-0030", rank: 1 },
      { lexemeId: "lx-0001", rank: 2 },
    ]);
  });
});

/**
 * Guards the specific defect found in this repository: `scripts/data/
 * freq-ca.tsv` is committed as `build-frequency.ts`'s audit artifact, but the
 * script overwrites it on *every* run - including a dry run nobody applied -
 * so it can silently stop being a record of the shipped lexicon's `freqRank`
 * and become a stale proposal instead. Measured: 38 Catalan entries disagree
 * with the shipped lexicon by more than 50 ranks (worst case `lx-4265`,
 * tsv-rank 623 vs lexicon 3622); Dari's TSV agrees with its lexicon exactly,
 * for every entry.
 *
 * This does NOT assert the two agree - they do not, today, and re-syncing
 * them (by rewriting either file) is separate work with its own review, not
 * something to do as a side effect of adding a test. It asserts the known
 * drift does not get worse without someone noticing: the ceiling below is the
 * measured count, so a future `build-frequency.ts` run that commits a fresh
 * TSV without also applying it to the lexicon - the exact way this drift
 * happened the first time - pushes the count up and fails the test loudly,
 * instead of silently shipping a second stale artifact next to the first.
 */
describe("shipped freq TSV vs lexicon", () => {
  // A corpus refresh reorders ties by a handful of ranks; only a gap this
  // large is evidence the TSV and lexicon describe different rankings.
  const TOLERANCE = 50;

  function driftFor(lang: "ca" | "prs") {
    const root = join(import.meta.dirname, "..", "content", lang);
    const entries = lexiconFileSchema.parse(
      JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
    ).entries;
    const tsv = parseFreqTsv(readFileSync(join(import.meta.dirname, "data", `freq-${lang}.tsv`), "utf8"));
    return tsvRankDrift(entries, tsv, TOLERANCE);
  }

  it("prs: freq-prs.tsv matches the shipped lexicon exactly", () => {
    expect(driftFor("prs")).toEqual([]);
  });

  it("ca: freq-ca.tsv's known drift from the shipped lexicon does not grow", () => {
    // Baseline is the measured count as of this test's introduction (38).
    // Small headroom, not a licence to add much more before this fails.
    const KNOWN_DRIFT_CEILING = 40;
    const drift = driftFor("ca");
    expect(
      drift.length,
      `${drift.length} entries disagree by more than ${TOLERANCE} ranks (ceiling ${KNOWN_DRIFT_CEILING}); ` +
        `worst: ${JSON.stringify(drift.slice().sort((a, b) => Math.abs(b.lexiconRank - b.tsvRank) - Math.abs(a.lexiconRank - a.tsvRank))[0])}`,
    ).toBeLessThanOrEqual(KNOWN_DRIFT_CEILING);
  });
});
