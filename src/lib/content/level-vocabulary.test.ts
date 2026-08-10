import { describe, expect, it } from "vitest";
import { profile } from "../lang/index.ts";
import { levelVocabulary } from "./level-vocabulary.ts";
import { isTeachable } from "./teachability.ts";
import { lexicon, levels } from "./load.ts";
import { BEGINNER_CORE_TAG } from "./word-selection.ts";

describe(`${profile.code} levelVocabulary`, () => {
  it("at L1 is exactly the beginner core", () => {
    // entryKnownWords is 0 at L1, so the in-band term is empty by
    // construction and the whole vocabulary comes from the core - which is
    // the point: a pre-A1 text has nothing else to build from.
    const l1 = levels[0];
    expect(l1.entryKnownWords).toBe(0);

    const vocab = levelVocabulary(l1, lexicon.entries, isTeachable);
    const core = lexicon.entries.filter((e) => e.tags.includes(BEGINNER_CORE_TAG) && isTeachable(e));
    expect(vocab.map((e) => e.id).sort()).toEqual(core.map((e) => e.id).sort());
  });

  it("is monotone: every word available at one level stays available at every level above it", () => {
    for (let i = 1; i < levels.length; i++) {
      const below = new Set(levelVocabulary(levels[i - 1], lexicon.entries, isTeachable).map((e) => e.id));
      const above = new Set(levelVocabulary(levels[i], lexicon.entries, isTeachable).map((e) => e.id));
      for (const id of below) {
        expect(above.has(id), `${levels[i - 1].id} has ${id} but ${levels[i].id} does not`).toBe(true);
      }
    }
  });

  it("grows with entryKnownWords and stays inside the lexicon", () => {
    let last = 0;
    for (const level of levels) {
      const vocab = levelVocabulary(level, lexicon.entries, isTeachable);
      expect(vocab.length).toBeGreaterThanOrEqual(last);
      expect(vocab.length).toBeLessThanOrEqual(lexicon.entries.length);
      last = vocab.length;
    }
  });

  it("never includes an untaught entry", () => {
    for (const level of levels) {
      for (const entry of levelVocabulary(level, lexicon.entries, isTeachable)) {
        expect(isTeachable(entry), `${entry.id} (${entry.target}) is not teachable`).toBe(true);
      }
    }
  });

  it("is sorted by frequency rank", () => {
    const vocab = levelVocabulary(levels.at(-1)!, lexicon.entries, isTeachable);
    for (let i = 1; i < vocab.length; i++) {
      expect(vocab[i].freqRank).toBeGreaterThanOrEqual(vocab[i - 1].freqRank);
    }
  });
});
