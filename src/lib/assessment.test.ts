import { describe, expect, it } from "vitest";
import { lexicon } from "./content/load.ts";
import { sampleAssessmentWords, scoreAssessment } from "./assessment.ts";

describe("assessment", () => {
  it("samples content words spread across frequency bands", () => {
    const words = sampleAssessmentWords(lexicon.entries);
    expect(words.length).toBeGreaterThan(20);
    const bands = new Set(words.map((w) => w.band));
    expect(bands.size).toBeGreaterThanOrEqual(4);
    // No pure function words as assessment items.
    expect(words.every((w) => !["particle", "conjunction", "preposition"].includes(w.entry.pos))).toBe(true);
  });

  it("estimates a larger vocabulary and higher level for more selections", () => {
    const words = sampleAssessmentWords(lexicon.entries);
    const none = scoreAssessment(words, new Set(), lexicon.entries);
    const all = scoreAssessment(words, new Set(words.map((w) => w.entry.id)), lexicon.entries);
    expect(all.estimatedVocab).toBeGreaterThan(none.estimatedVocab);
    expect(all.knownLexemeIds.length).toBeGreaterThan(none.knownLexemeIds.length);
    expect(none.levelId).toBe("L1");
  });
});
