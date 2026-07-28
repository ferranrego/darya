import { describe, expect, it } from "vitest";
import { lexicon } from "./content/load.ts";
import { sampleAssessmentWords, scoreAssessment } from "./assessment.ts";

describe("assessment", () => {
  it("samples content words spread across frequency bands", () => {
    const words = sampleAssessmentWords(lexicon.entries);
    // Scaled to the lexicon actually loaded: Catalan ships 250 entries today
    // against Dari's 6000, so a fixed floor would fail on content volume rather
    // than on the sampling logic this test is about.
    expect(words.length).toBeGreaterThan(Math.min(20, Math.floor(lexicon.entries.length / 40)));
    const bands = new Set(words.map((w) => w.band));
    // A 250-word lexicon spans fewer frequency bands than a 6000-word one, so
    // assert against the bands the lexicon actually has rather than a fixed 4.
    const available = new Set(lexicon.entries.map((e) => e.freqBand)).size;
    expect(bands.size).toBeGreaterThanOrEqual(Math.min(4, available));
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
