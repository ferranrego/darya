import { describe, expect, it } from "vitest";
import { insertionOrderSuffix } from "./freq-integrity.ts";
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
