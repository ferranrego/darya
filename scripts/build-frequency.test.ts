import { describe, expect, it } from "vitest";
import { readCuratedRanks } from "./build-frequency.ts";

/**
 * The curated order is the spine of Dari's frequency ranking - it carries 0.75
 * of the blend precisely because the corpora are Iranian and are evidence about
 * the wrong language for the few percent of vocabulary where the varieties
 * differ.
 *
 * This exists because that spine dissolved once already: `curated` was read
 * from the lexicon's own `freqRank`, i.e. from this script's previous output,
 * so every run blended the last answer with the corpora again. Three runs on an
 * unchanged lexicon moved موتر 915 -> 1273 -> 1637. The failure was invisible
 * because each individual run looked reasonable.
 */
describe("readCuratedRanks", () => {
  const ranks = readCuratedRanks();

  it("finds the hand-authored ranks", () => {
    expect(ranks.size).toBeGreaterThan(5000);
  });

  /**
   * The three the script's own header cites as proof that curation beats the
   * corpora here. If these drift, the header is lying and so is the ranking.
   */
  it("keeps the Afghan core at its authored rank", () => {
    expect(ranks.get("مکتب")).toBe(75);
    expect(ranks.get("موتر")).toBe(83);
    expect(ranks.get("کلان")).toBe(65);
  });

  /**
   * The Iranian equivalents are either absent or deliberately ranked far below
   * the Afghan word - بیمارستان is curated at 5342 and tagged formal, which is
   * the curation doing its job rather than failing to. What must never happen
   * is one of them outranking the Afghan word a learner should meet first.
   */
  it("never ranks an Iranian form above its Afghan equivalent", () => {
    const pairs: [string, string][] = [
      ["شفاخانه", "بیمارستان"],
      ["مکتب", "مدرسه"],
      ["موتر", "ماشین"],
    ];
    const LAST = Number.MAX_SAFE_INTEGER;
    for (const [afghan, iranian] of pairs) {
      const a = ranks.get(afghan);
      expect(a, `${afghan} should carry an authored rank`).toBeDefined();
      expect(ranks.get(iranian) ?? LAST).toBeGreaterThan(a!);
    }
  });

  it("parses a rank for every entry it returns", () => {
    for (const [, rank] of ranks) {
      expect(Number.isInteger(rank)).toBe(true);
      expect(rank).toBeGreaterThan(0);
    }
  });
});
