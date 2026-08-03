import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { levelsFileSchema, lexiconFileSchema, type LexiconEntry } from "./schema.ts";
import { isTeachable, teachabilityDefects } from "./teachability.ts";
import { selectTargets, targetCountFor } from "./word-selection.ts";

const LANGS = ["ca", "prs"] as const;

function load(lang: string) {
  const root = join(import.meta.dirname, "..", "..", "..", "content", lang);
  return {
    entries: lexiconFileSchema.parse(
      JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
    ).entries,
    levels: levelsFileSchema.parse(
      JSON.parse(readFileSync(join(root, "levels", "levels.json"), "utf8")),
    ).levels,
  };
}

const entry = (over: Partial<LexiconEntry>): LexiconEntry =>
  ({
    id: "lx-test",
    target: "casa",
    targetNormalized: "casa",
    glossEn: "house",
    pos: "noun",
    freqRank: 1,
    freqBand: 1,
    register: "neutral",
    variants: [],
    exampleTarget: "La casa és gran.",
    exampleEn: "The house is big.",
    tags: [],
    ...over,
  }) as LexiconEntry;

describe("teachability", () => {
  it("accepts a complete entry", () => {
    expect(teachabilityDefects(entry({}))).toEqual([]);
  });

  it("rejects the three shapes bulk generation actually left behind", () => {
    // Every one of these is schema-valid, which is why they shipped.
    expect(teachabilityDefects(entry({ glossEn: "[C2 auto-fill]" }))).toContain("placeholder-gloss");
    expect(teachabilityDefects(entry({ target: "riure", exampleTarget: "riure" }))).toContain(
      "example-is-headword",
    );
    expect(
      teachabilityDefects(entry({ exampleEn: "Translated: La casa és gran." })),
    ).toContain("untranslated-example");
  });

  it("does not reject a gloss that merely mentions a bracket-free note", () => {
    expect(isTeachable(entry({ glossEn: "house (dwelling)" }))).toBe(true);
  });
});

describe.each(LANGS)("%s teachable pool", (lang) => {
  const { entries, levels } = load(lang);

  it("leaves every level enough words to teach", () => {
    // Quarantining is only safe if it cannot starve a level: a level with no
    // teachable candidate left would produce texts that teach nothing, which
    // is the failure the quarantine exists to prevent.
    //
    // Restricted to `available` levels: an unavailable one (Catalan's C1/C2,
    // whose vocabulary isn't finished) can never actually be reached by a
    // learner - `scoreAssessment` and the reading level-up check both gate on
    // exactly this flag - so a thin pool there cannot starve anyone. Without
    // this, growing B2 to its real CEFR figure pushed C1's already-compressed
    // threshold close enough to B2's that its sliver of a candidate pool
    // failed this check, even though no learner could ever draw from it.
    for (const level of levels.filter((l) => l.available)) {
      const candidates = entries.filter(
        (e) =>
          level.freqBands.includes(e.freqBand) &&
          e.freqRank > level.entryKnownWords &&
          isTeachable(e),
      );
      const needed = targetCountFor(level, 0.05);
      expect(
        candidates.length,
        `${level.id} (${level.cefrHint}) has ${candidates.length} teachable candidates, needs ${needed}`,
      ).toBeGreaterThanOrEqual(needed * 4);
    }
  });

  it("never selects a word it cannot teach", () => {
    for (const level of levels) {
      const candidates = entries.filter(
        (e) =>
          level.freqBands.includes(e.freqBand) &&
          e.freqRank > level.entryKnownWords &&
          isTeachable(e),
      );
      const picked = selectTargets({ candidates, count: targetCountFor(level, 0.05), seed: 3 });
      for (const p of picked) {
        expect(teachabilityDefects(p), `${level.id} picked ${p.target}`).toEqual([]);
      }
    }
  });
});
