import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { levelsFileSchema, lexiconFileSchema, type LexiconEntry } from "./schema.ts";
import { isTeachable } from "./teachability.ts";
import {
  BEGINNER_CORE_TAG,
  coldStartKnown,
  isBeginnerLevel,
  selectKnown,
  selectTargets,
  shuffle,
  targetCountFor,
  teachablePool,
} from "./word-selection.ts";

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
      for (const level of levels) {
        const n = targetCountFor(level, 0.05);
        expect(n, `${level.id} asks for ${n} new words`).toBeGreaterThanOrEqual(2);
        // The old ceiling of 15 produced texts the model simply ignored.
        // Beginner levels get a higher one because their words are concrete.
        const ceiling = isBeginnerLevel(level) ? 10 : 8;
        expect(n, `${level.id} asks for ${n} new words`).toBeLessThanOrEqual(ceiling);
      }
    });

    it("gives beginner levels one new word per sentence, capped low", () => {
      // Deliberately not derived from the ratio, and deliberately LOW.
      //
      // This was two new words per sentence (cap 10) while a beginner text was
      // a set of independent useful sentences - each one picturable, so *El gos
      // menja molta carn* could teach four at once. Once the beginner prompt
      // became a cohesive micro-narrative, that stopped working: a continuous
      // story cannot absorb eight mandatory new words without inventing
      // vocabulary outside the allowed list, which is the one thing the prompt
      // forbids. One per sentence, capped at 4, is what a narrative can carry.
      //
      // The ratio stays inert here by design: its whole 0.02-0.25 range
      // collapsed to two or three words at these levels, so it could not
      // express the difference at exactly the levels where new vocabulary
      // matters most.
      for (const level of levels.filter(isBeginnerLevel)) {
        const mid = (level.sentenceRange[0] + level.sentenceRange[1]) / 2;
        const want = Math.max(2, Math.min(4, Math.round(mid)));
        expect(targetCountFor(level, 0.05), `${level.id}`).toBe(want);
        expect(targetCountFor(level, 0.25), `${level.id} must ignore the ratio`).toBe(want);
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

describe.each(LANGS)("%s beginner predominance", (lang) => {
  const { levels, entries } = load(lang);
  const beginner = levels.filter(isBeginnerLevel);
  const upper = levels.at(-1)!;

  it("has beginner levels to test", () => {
    expect(beginner.length, `${lang} declares no pre-A1/A1 level`).toBeGreaterThan(0);
  });

  it("cold start hands a new learner concrete words, not de/ser/el/la", () => {
    // The fallback used to be the sixty commonest words in the language, which
    // is the worst possible opening vocabulary and was what every new user got.
    for (const level of beginner) {
      const out = coldStartKnown(entries, level, isTeachable, 60);
      expect(out.length, `${level.id} cold start is empty`).toBeGreaterThan(0);
      const core = out.filter((e) => e.tags.includes(BEGINNER_CORE_TAG)).length;
      expect(
        core / out.length,
        `${level.id} cold start is only ${core}/${out.length} beginner-core`,
      ).toBeGreaterThan(0.8);
    }
  });

  it("selectKnown leads with the core at beginner levels and not above them", () => {
    // Both halves of the prompt have to come from the same pool. While only
    // selectTargets preferred the core, the model was told to teach `poma` and
    // `gos` while building from `de, ser, el, la, que, estat, cosa, manera`.
    const known = entries.filter(isTeachable).slice(0, 3000);
    const head = (level: (typeof levels)[number]) =>
      selectKnown({ known, level })
        .slice(0, 20)
        .filter((e) => e.tags.includes(BEGINNER_CORE_TAG)).length;

    for (const level of beginner) {
      expect(head(level), `${level.id} head is not core-led`).toBeGreaterThanOrEqual(18);
    }
    // Above A1 frequency decides again, or the text stops reading at level.
    const upperHead = selectKnown({ known, level: upper }).slice(0, 20);
    expect(upperHead.every((e, i, a) => i === 0 || a[i - 1].freqRank <= e.freqRank)).toBe(true);
  });
});

describe.each(LANGS)("%s beginner targets are worth teaching", (lang) => {
  const { levels, entries } = load(lang);

  for (const level of levels.filter(isBeginnerLevel)) {
    const candidates = teachablePool(entries, level, () => false, isTeachable);
    const count = targetCountFor(level, 0.05);
    const draws = [3, 11, 29, 47].map((seed) =>
      selectTargets({ candidates, count, preferBeginnerCore: true, seed }),
    );

    it(`${level.id}: teaches content words, not the article and the copula`, () => {
      // Tagging the closed classes beginner-core made the tag mean two things
      // at once, and pre-A1 started teaching `ser, la, no, amb, es, què, pel` -
      // seven of ten slots on function words. A beginner absorbs those from
      // every sentence that uses one; the cards should hold `gos` and `poma`.
      for (const picked of draws) {
        const content = picked.filter((e) =>
          ["noun", "verb", "adjective", "adverb"].includes(e.pos),
        );
        expect(
          content.length,
          `${level.id} taught ${picked.length - content.length} function words: ` +
            picked.map((e) => `${e.target}/${e.pos}`).join(" "),
        ).toBe(picked.length);
      }
    });

    it(`${level.id}: reaches beyond the frequency head`, () => {
      // Ordering the core by corpus frequency and slicing the top 60 reached
      // `home, parlar, pensar, moment` and never `gos` (ca rank 1546), `poma`
      // (1468) or `taula` (1161) - the premise of the core restated as a bug.
      const ranks = draws.flat().map((e) => e.freqRank);
      expect(
        Math.max(...ranks),
        `${level.id} never left the frequency head`,
      ).toBeGreaterThan(700);
    });

    it(`${level.id}: does not open every text with the same word`, () => {
      // `byRank.find(isVerb)` returned the single lowest-ranked verb every
      // time, so every beginner text began by teaching `ser` / `است`.
      const firsts = new Set(draws.map((d) => d[0]?.id));
      expect(firsts.size, `every draw started with the same word`).toBeGreaterThan(1);
    });
  }
});
