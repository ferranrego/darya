import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { levelsFileSchema, lexiconFileSchema } from "./schema.ts";

/**
 * The level table makes two promises to the learner, and both have been broken
 * silently before.
 *
 * `entryKnownWords` is shown on the Words screen as "N / 500 known words
 * towards A1", so it is a claim about the CEFR level, not about this
 * repository. Deriving it from the lexicon's frequency bands made it circular -
 * bands are an arbitrary geometric split of however many words the file happens
 * to contain - and Dari A1 silently fell from 500 words to 121, telling
 * learners they were four times closer to A1 than they were.
 *
 * `freqBands` decides what a level may teach. If a level's bands do not reach
 * past its own entry threshold it can introduce nothing, the generator finds no
 * target words, and the reader sits on "Writing your next text…" forever.
 */

const LANGS = ["ca", "prs"] as const;

function load(lang: string) {
  const root = join(import.meta.dirname, "..", "..", "..", "content", lang);
  const levels = levelsFileSchema.parse(
    JSON.parse(readFileSync(join(root, "levels", "levels.json"), "utf8")),
  ).levels;
  const entries = lexiconFileSchema.parse(
    JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
  ).entries;
  return { levels, entries };
}

describe.each(LANGS)("%s levels", (lang) => {
  const { levels, entries } = load(lang);
  const bandTop = new Map<number, number>();
  for (const e of entries) {
    bandTop.set(e.freqBand, Math.max(bandTop.get(e.freqBand) ?? 0, e.freqRank));
  }

  it("starts at zero and rises strictly", () => {
    expect(levels[0].entryKnownWords).toBe(0);
    for (let i = 1; i < levels.length; i++) {
      expect(
        levels[i].entryKnownWords,
        `${levels[i].id} (${levels[i].cefrHint}) must require more words than ${levels[i - 1].id}`,
      ).toBeGreaterThan(levels[i - 1].entryKnownWords);
    }
  });

  it("asks for a plausible vocabulary at A1 and A2", () => {
    // Guards the specific regression: a threshold derived from band edges
    // rather than from what the CEFR level means. Published receptive-
    // vocabulary figures put A1 near 500 lemmas and A2 near 1,200; the bounds
    // are wide enough for deliberate tuning and tight enough to catch a
    // rescaling of the lexicon.
    const byHint = new Map(levels.map((l) => [l.cefrHint, l.entryKnownWords]));
    const a1 = byHint.get("A1");
    const a2 = byHint.get("A2");
    expect(a1, "no A1 level").toBeDefined();
    expect(a1!, "A1 should sit near 500 lemmas").toBeGreaterThanOrEqual(300);
    expect(a1!, "A1 should sit near 500 lemmas").toBeLessThanOrEqual(900);
    if (a2 !== undefined) {
      expect(a2, "A2 should sit near 1,200 lemmas").toBeGreaterThanOrEqual(800);
      expect(a2, "A2 should sit near 1,200 lemmas").toBeLessThanOrEqual(1800);
    }
  });

  it("gives every level something it can still teach", () => {
    for (const level of levels) {
      const teachesTo = bandTop.get(Math.max(...level.freqBands)) ?? 0;
      expect(
        teachesTo,
        `${level.id} (${level.cefrHint}) arrives knowing ${level.entryKnownWords} but its ` +
          `bands only reach rank ${teachesTo} - it can introduce no new word`,
      ).toBeGreaterThan(level.entryKnownWords);
    }
  });

  it("can teach a learner all the way to the next level", () => {
    for (let i = 0; i < levels.length - 1; i++) {
      const teachesTo = bandTop.get(Math.max(...levels[i].freqBands)) ?? 0;
      expect(
        teachesTo,
        `${levels[i].id} cannot reach ${levels[i + 1].id}'s entry threshold ` +
          `(${levels[i + 1].entryKnownWords}), so a learner cannot progress out of it`,
      ).toBeGreaterThanOrEqual(levels[i + 1].entryKnownWords);
    }
  });

  it("keeps the top level's threshold inside the lexicon", () => {
    const top = levels.at(-1)!;
    expect(
      top.entryKnownWords,
      `${top.id} requires more words than the ${lang} lexicon contains (${entries.length})`,
    ).toBeLessThan(entries.length);
  });
});
