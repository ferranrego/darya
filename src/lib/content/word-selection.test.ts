import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { levelsFileSchema, lexiconFileSchema, type LexiconEntry } from "./schema.ts";
import { selectKnown, selectTargets, shuffle, targetCountFor } from "./word-selection.ts";

/**
 * These run against the real shipped content for both languages, because the
 * failure being guarded is a property of the lexicons: they are roughly
 * three-quarters nouns, so any selection that does not actively push back ends
 * up teaching nine nouns in a row.
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

describe("shuffle", () => {
  it("is uniform, unlike the comparator it replaced", () => {
    // `sort(() => Math.random() - 0.5)` leaves the first element in place far
    // more often than chance, which meant the same words were taught over and
    // over. 10k draws of a 5-element array: each landing position should be
    // near 2,000, and a biased shuffle misses by a wide margin.
    const items = [0, 1, 2, 3, 4];
    const landedFirst = new Array(5).fill(0);
    let seed = 1;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    for (let i = 0; i < 10_000; i++) landedFirstInc(shuffle(items, rand), landedFirst);
    for (const count of landedFirst) {
      expect(count).toBeGreaterThan(1700);
      expect(count).toBeLessThan(2300);
    }
  });
});

function landedFirstInc(out: number[], tally: number[]) {
  tally[out[0]]++;
}

describe.each(LANGS)("%s word selection", (lang) => {
  const { levels, entries } = load(lang);

  describe("targetCountFor", () => {
    it("scales with the level's own sentence length and stays teachable", () => {
      let previous = 0;
      for (const level of levels) {
        const n = targetCountFor(level, 0.05);
        expect(n, `${level.id} asks for ${n} new words`).toBeGreaterThanOrEqual(2);
        // The old ceiling of 15 produced texts the model simply ignored.
        expect(n, `${level.id} asks for ${n} new words`).toBeLessThanOrEqual(8);
        expect(n).toBeGreaterThanOrEqual(previous - 1);
        previous = n;
      }
    });

    it("responds to the learner's ratio", () => {
      const level = levels.at(-1)!;
      expect(targetCountFor(level, 0.25)).toBeGreaterThan(targetCountFor(level, 0.01));
    });
  });

  describe("selectTargets", () => {
    for (const level of levels) {
      const known = new Set(
        entries.filter((e) => e.freqRank <= level.entryKnownWords).map((e) => e.id),
      );
      const candidates = entries.filter(
        (e) => level.freqBands.includes(e.freqBand) && !known.has(e.id),
      );
      const count = targetCountFor(level, 0.05);

      it(`${level.id}: never returns a known or out-of-band word`, () => {
        const picked = selectTargets({ candidates, count, seed: 7 });
        expect(picked.length).toBe(Math.min(count, candidates.length));
        for (const p of picked) {
          expect(known.has(p.id), `${p.target} is already known`).toBe(false);
          expect(level.freqBands, `${p.target} is out of band`).toContain(p.freqBand);
        }
        expect(new Set(picked.map((p) => p.id)).size, "duplicates").toBe(picked.length);
      });

      it(`${level.id}: does not return an all-noun set when the pool has alternatives`, () => {
        const hasOther = candidates.some((e) => e.pos !== "noun");
        const picked = selectTargets({ candidates, count, seed: 7 });
        if (!hasOther || picked.length < 2) return;
        expect(
          new Set(picked.map((p) => p.pos)).size,
          `${level.id} picked only ${picked[0].pos}: ${picked.map((p) => p.target).join(", ")}`,
        ).toBeGreaterThanOrEqual(2);
      });

      it(`${level.id}: includes a verb when one is available`, () => {
        // Verb morphology is what every level's grammarAllowed is about; a
        // reader that never introduces a verb cannot exercise it.
        if (!candidates.some((e) => e.pos === "verb")) return;
        const picked = selectTargets({ candidates, count, seed: 7 });
        expect(
          picked.some((p) => p.pos === "verb"),
          `${level.id} taught no verb: ${picked.map((p) => `${p.target}/${p.pos}`).join(", ")}`,
        ).toBe(true);
      });
    }

    it("is reproducible given a seed and varies without one", () => {
      const level = levels[1];
      const candidates = entries.filter((e) => level.freqBands.includes(e.freqBand));
      const a = selectTargets({ candidates, count: 5, seed: 42 }).map((e) => e.id);
      const b = selectTargets({ candidates, count: 5, seed: 42 }).map((e) => e.id);
      expect(a).toEqual(b);

      const draws = new Set<string>();
      for (let i = 0; i < 20; i++) {
        draws.add(selectTargets({ candidates, count: 5 }).map((e) => e.id).join(","));
      }
      expect(draws.size, "unseeded selection never varied").toBeGreaterThan(1);
    });

    it("returns nothing rather than throwing on an empty pool", () => {
      expect(selectTargets({ candidates: [], count: 5 })).toEqual([]);
    });
  });

  describe("selectKnown", () => {
    const known: LexiconEntry[] = entries.slice(0, 3000);

    it("gives upper levels more vocabulary than lower ones", () => {
      // The flat 160-word cap it replaced described a B2 learner to the model
      // as knowing about 6% of their vocabulary.
      const first = selectKnown({ known, level: levels[0] }).length;
      const last = selectKnown({ known, level: levels.at(-1)! }).length;
      expect(last).toBeGreaterThan(first);
      expect(last).toBeLessThanOrEqual(600);
    });

    it("puts due words first without letting them take over the list", () => {
      const level = levels.at(-1)!;
      const dueIds = new Set(known.slice(1500, 2500).map((e) => e.id));
      const out = selectKnown({ known, level, dueIds });
      const budget = out.length;

      const dueInOut = out.filter((e) => dueIds.has(e.id)).length;
      expect(dueInOut, "no due words were surfaced").toBeGreaterThan(0);
      expect(dueInOut, "due words crowded out the rest").toBeLessThanOrEqual(Math.ceil(budget / 2));
      // The head of the list is what the model reads most carefully.
      expect(dueIds.has(out[0].id)).toBe(true);
    });

    it("is unchanged when nothing is due", () => {
      const level = levels[2];
      expect(selectKnown({ known, level, dueIds: new Set() })).toEqual(
        selectKnown({ known, level }),
      );
    });
  });
});
