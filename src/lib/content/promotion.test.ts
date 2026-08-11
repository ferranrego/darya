import { describe, expect, it } from "vitest";
import { nextLevelFor, type LevelCoverage } from "./promotion.ts";
import type { Level } from "./schema.ts";

/**
 * Pure logic, fabricated fixtures - no real content needed. `isBeginnerLevel`
 * (imported inside promotion.ts) keys off `cefrHint`, so these fixtures use
 * the same "pre-A1"/"A1" strings the real content does to be a beginner
 * level, and anything else to not be one.
 */
function makeLevel(overrides: Partial<Level> & { id: string }): Level {
  return {
    name: overrides.id,
    cefrHint: "A2",
    freqBands: [1],
    entryKnownWords: 0,
    sentenceRange: [1, 3],
    sentenceLengthHint: "short",
    maxSentenceWords: 8,
    avgSentenceWords: 6,
    grammarAllowed: [],
    available: true,
    ...overrides,
  };
}

const L1 = makeLevel({ id: "L1", cefrHint: "A1", entryKnownWords: 0 });
const L2 = makeLevel({ id: "L2", cefrHint: "A2", entryKnownWords: 500 });
const L3 = makeLevel({ id: "L3", cefrHint: "B1", entryKnownWords: 1200 });
const L4 = makeLevel({ id: "L4", cefrHint: "B2", entryKnownWords: 2500 });
const levels: Level[] = [L1, L2, L3, L4];

const coverage = (met: number, total: number, allSeedTextsRead: boolean): LevelCoverage => ({
  met,
  total,
  allSeedTextsRead,
});

describe("nextLevelFor", () => {
  it("global rule alone: promotes to the highest level whose entryKnownWords is cleared, including a multi-level jump", () => {
    const result = nextLevelFor({ current: L1, levels, knownCount: 2500 });
    expect(result?.id).toBe("L4");
  });

  it("global rule alone: does not promote when knownCount clears nothing above the current level", () => {
    const result = nextLevelFor({ current: L1, levels, knownCount: 0 });
    expect(result).toBeNull();
  });

  it("coverage rule promotes exactly one level up when ratio >= 0.7 and all seed texts are read", () => {
    const result = nextLevelFor({
      current: L1,
      levels,
      knownCount: 0,
      levelCoverage: coverage(70, 100, true),
    });
    expect(result?.id).toBe("L2");
  });

  it("coverage rule does not fire when the ratio is below 0.7", () => {
    const result = nextLevelFor({
      current: L1,
      levels,
      knownCount: 0,
      levelCoverage: coverage(69, 100, true),
    });
    expect(result).toBeNull();
  });

  it("coverage rule does not fire when seed texts are incomplete, even at a sufficient ratio", () => {
    const result = nextLevelFor({
      current: L1,
      levels,
      knownCount: 0,
      levelCoverage: coverage(100, 100, false),
    });
    expect(result).toBeNull();
  });

  it("coverage rule does not apply at a non-beginner level even if a levelCoverage is passed", () => {
    const result = nextLevelFor({
      current: L2,
      levels,
      knownCount: 0,
      levelCoverage: coverage(100, 100, true),
    });
    expect(result).toBeNull();
  });

  it("the higher of the two rules wins when both fire: global rule wins when it clears further", () => {
    const result = nextLevelFor({
      current: L1,
      levels,
      knownCount: 1200, // clears L3's gate
      levelCoverage: coverage(70, 100, true), // would only reach L2
    });
    expect(result?.id).toBe("L3");
  });

  it("the higher of the two rules wins when both fire: coverage rule wins when the global rule cannot reach past the current level", () => {
    const result = nextLevelFor({
      current: L1,
      levels,
      knownCount: 0, // global rule stays at L1
      levelCoverage: coverage(70, 100, true), // coverage reaches L2
    });
    expect(result?.id).toBe("L2");
  });

  it("returns null when current is not found in levels", () => {
    const unknown = makeLevel({ id: "LX", cefrHint: "A1" });
    const result = nextLevelFor({
      current: unknown,
      levels,
      knownCount: 999999,
      levelCoverage: coverage(100, 100, true),
    });
    expect(result).toBeNull();
  });

  it("returns null when neither rule fires", () => {
    const result = nextLevelFor({ current: L1, levels, knownCount: 0 });
    expect(result).toBeNull();
  });
});
