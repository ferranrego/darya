import { describe, expect, it } from "vitest";
import { lexicon } from "../content/load.ts";
import type { LexiconEntry } from "../content/schema.ts";
import { curricularKnownCount, entryFor, isPersonalId } from "./lookup.ts";

/**
 * These guard the rule that makes personal dictionaries safe to put in
 * `user_words`: a `ux-` id is a word the learner glossed from an article they
 * imported, and it must never be mistaken for curriculum vocabulary.
 */

function personalEntry(id: string, target: string): LexiconEntry {
  return {
    id,
    target,
    targetNormalized: target,
    glossEn: "personal gloss",
    pos: "noun",
    freqRank: Number.MAX_SAFE_INTEGER,
    freqBand: 10,
    register: "neutral",
    variants: [],
    exampleTarget: target,
    exampleEn: "personal gloss",
    tags: ["imported"],
  };
}

describe("isPersonalId", () => {
  it("separates personal ids from shipped ones", () => {
    expect(isPersonalId("ux-0a1b2c3d4e5f")).toBe(true);
    expect(isPersonalId("lx-0001")).toBe(false);
  });
});

describe("entryFor", () => {
  it("resolves a personal id through the personal map", () => {
    const map = new Map([["ux-deadbeef01", personalEntry("ux-deadbeef01", "zzz")]]);
    expect(entryFor("ux-deadbeef01", map)?.glossEn).toBe("personal gloss");
  });

  it("returns undefined for a personal id with no personal map", () => {
    expect(entryFor("ux-deadbeef01")).toBeUndefined();
  });

  // The invariant: a gloss is a model's guess at a lemma, a lexicon entry is
  // reviewed content. If a personal row ever collides with a real lexeme id,
  // the curated entry is what the learner must see.
  it("never lets a personal entry shadow the shipped lexicon", () => {
    const real = lexicon.entries[0];
    const impostor = new Map([[real.id, personalEntry("ux-000000000000", "impostor")]]);
    expect(entryFor(real.id, impostor)).toBe(real);
  });
});

describe("curricularKnownCount", () => {
  it("counts known lexicon words only", () => {
    const words = [
      { lexeme_id: "lx-0001", status: "known" },
      { lexeme_id: "lx-0002", status: "learning" },
      { lexeme_id: "ux-aaaaaaaaaaaa", status: "known" },
      { lexeme_id: "ux-bbbbbbbbbbbb", status: "known" },
    ];
    expect(curricularKnownCount(words)).toBe(1);
  });

  // The bug this exists to prevent: importing two hard articles and marking
  // their vocabulary known would otherwise jump a learner several CEFR levels.
  it("is zero for a learner whose known words are all imported", () => {
    const words = Array.from({ length: 500 }, (_, i) => ({
      lexeme_id: `ux-${i.toString(16).padStart(12, "0")}`,
      status: "known",
    }));
    expect(curricularKnownCount(words)).toBe(0);
  });
});
