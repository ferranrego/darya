import { describe, expect, it } from "vitest";
import { profile } from "../lang/index.ts";
import { genderOf, isAnimate, isEdible, isHuman, isPlace } from "./noun-features.ts";
import { lexicon } from "./load.ts";

describe(`${profile.code} noun features`, () => {
  it("finds real places, and does not call an arbitrary noun a place", () => {
    const places = lexicon.entries.filter(isPlace);
    expect(places.length).toBeGreaterThan(5);
    // A word with no semantic field at all - most of the lexicon - must never
    // pass. If this fails, isPlace has stopped checking anything.
    const untyped = lexicon.entries.find((e) => e.pos === "noun" && !isPlace(e) && !isHuman(e) && !isAnimate(e) && !isEdible(e));
    expect(untyped).toBeDefined();
  });

  it("edible words are food, not verbs that happen to be near food in the spec", () => {
    for (const entry of lexicon.entries.filter(isEdible)) {
      expect(entry.pos, `${entry.id} (${entry.target}) marked edible with pos=${entry.pos}`).toBe("noun");
    }
    const edible = lexicon.entries.filter(isEdible);
    expect(edible.length).toBeGreaterThan(5);
  });

  it("isAnimate is a strict superset of isHuman", () => {
    for (const entry of lexicon.entries) {
      if (isHuman(entry)) {
        expect(isAnimate(entry), `${entry.id} (${entry.target}) is human but not animate`).toBe(true);
      }
    }
  });

  it("place, human and edible are mutually exclusive for any given word", () => {
    // A word can be a place OR edible OR human, never two at once - the
    // fields it derives from don't overlap. If this ever fails it means
    // beginner-spec.json itself put one seed word in two fields whose
    // semantics conflict, which is worth knowing about directly.
    for (const entry of lexicon.entries) {
      const flags = [isPlace(entry), isHuman(entry), isEdible(entry)].filter(Boolean).length;
      expect(flags, `${entry.id} (${entry.target}) matches more than one of place/human/edible`).toBeLessThanOrEqual(1);
    }
  });
});

describe("ca gender", () => {
  it.runIf(profile.code === "ca")("agrees with the derivation script's output where it has run", () => {
    const gendered = lexicon.entries.filter((e) => e.gender !== undefined);
    // Non-empty only after `derive-ca-gender.ts --apply` has run; this guards
    // the *shape* of whatever is there, not a specific count, so it passes
    // both before and after that content lands.
    for (const entry of gendered) {
      expect(["m", "f", "common"]).toContain(genderOf(entry));
    }
  });

  it.runIf(profile.code === "prs")("is never set - Dari has no grammatical gender", () => {
    expect(lexicon.entries.some((e) => e.gender !== undefined)).toBe(false);
  });
});
