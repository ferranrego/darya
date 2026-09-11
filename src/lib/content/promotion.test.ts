import { describe, expect, it } from "vitest";
import { curricularKnownCount } from "../lexeme/lookup.ts";
import { evidenceBlocks, nextLevelFor, type LevelCoverage } from "./promotion.ts";
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

  /**
   * Imported articles put `ux-` ids into `user_words` alongside curriculum
   * vocabulary. `entryKnownWords` is a count against the frequency-ordered
   * lexicon (PEDAGOGY.md §3), so a learner who imports two hard articles and
   * marks their vocabulary known would otherwise be promoted several levels for
   * work that taught them none of the course. Stated as behaviour here rather
   * than as a `.not("lexeme_id","like",...)` in one query, so the rule survives
   * a rewrite of how the count is fetched.
   */
  it("does not promote on a known-count made only of imported words", () => {
    const words = Array.from({ length: 900 }, (_, i) => ({
      lexeme_id: `ux-${i.toString(16).padStart(12, "0")}`,
      status: "known",
    }));
    const result = nextLevelFor({
      current: L1,
      levels,
      knownCount: curricularKnownCount(words),
    });
    expect(result).toBeNull();
  });
});

/**
 * Promotion has only ever counted words marked "known" - never accuracy, never
 * retention, never comprehension. These pin the two decisions that make the
 * new floors safe to ship: they must not fire on noise, and they must never
 * cost a learner a level they already have.
 */
describe("promoting on evidence rather than on claims", () => {
  const levels = [L1, L2, L3, L4];
  const advanced = { current: L1, levels, knownCount: L4.entryKnownWords };

  it("promotes exactly as before when there is no evidence yet", () => {
    // Every learner already mid-course has no comprehension history at all -
    // the feature did not exist. Holding them for the app's own omission would
    // punish them for a change they did not make.
    expect(nextLevelFor(advanced)?.id).toBe(nextLevelFor({ ...advanced, evidence: undefined })?.id);
  });

  it("holds a learner whose words are not sticking", () => {
    const blocked = nextLevelFor({
      ...advanced,
      evidence: { reviews: 200, retention: 0.4, checks: 0, comprehension: 0 },
    });
    expect(blocked).toBeNull();
  });

  it("holds a learner who is finishing texts without understanding them", () => {
    const blocked = nextLevelFor({
      ...advanced,
      evidence: { reviews: 200, retention: 0.95, checks: 40, comprehension: 0.2 },
    });
    expect(blocked).toBeNull();
  });

  it("does not fire on too little evidence to mean anything", () => {
    // Two reviews and one quiz is not a measurement, and refusing a promotion
    // on it would be refusing on noise.
    const thin = nextLevelFor({
      ...advanced,
      evidence: { reviews: 3, retention: 0, checks: 1, comprehension: 0 },
    });
    expect(thin?.id).toBe(nextLevelFor(advanced)?.id);
  });

  it("lets a learner doing the work through without noticing the floors", () => {
    // FSRS here targets 0.90 retention, so this is what doing the work looks
    // like. The floors are a guard against coasting, not a bar to clear.
    const fine = nextLevelFor({
      ...advanced,
      evidence: { reviews: 200, retention: 0.9, checks: 40, comprehension: 0.85 },
    });
    expect(fine?.id).toBe(nextLevelFor(advanced)?.id);
  });

  it("says which floor is missing, so the learner can act on it", () => {
    // "Not yet" with no reason is the same dead end as having no requirement.
    expect(evidenceBlocks({ reviews: 200, retention: 0.4, checks: 0, comprehension: 0 }))
      .toMatch(/sticking/);
    expect(evidenceBlocks({ reviews: 200, retention: 0.95, checks: 40, comprehension: 0.2 }))
      .toMatch(/understood/);
    expect(evidenceBlocks(undefined)).toBeNull();
  });

  it("never demotes: the rule applies to the next promotion, not the level held", () => {
    // nextLevelFor returns null to mean "stay put", never a lower level.
    for (const retention of [0, 0.3, 0.5, 0.9]) {
      const result = nextLevelFor({
        current: L3,
        levels,
        knownCount: 0,
        evidence: { reviews: 200, retention, checks: 40, comprehension: 0.1 },
      });
      expect(result, `retention ${retention}`).toBeNull();
    }
  });
});
