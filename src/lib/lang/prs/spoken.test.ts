import { describe, expect, it } from "vitest";

import { lexicon, lexiconIndex } from "../../content/load.ts";
import { CONTESTED_SPOKEN, SPOKEN_FORMS, SPOKEN_TRANSLIT, spokenFormOf } from "./spoken.ts";

/**
 * The recogniser used to answer three Kabuli forms with a different word
 * entirely - ره as "to escape", بری as "to carry", مه as "fog" - and a learner
 * tapping one in a message from a real Afghan speaker got that word written
 * into their review deck. Nothing looked broken. These pin what is fixed and,
 * just as importantly, what deliberately is not.
 */
const index = lexiconIndex();

describe("Kabul spoken forms in the recogniser", () => {
  it("points every listed form at a headword the lexicon actually has", () => {
    // A spoken form aimed at a word that does not exist is a defect in the
    // table, and would fail silently at runtime.
    const known = new Set(lexicon.entries.map((e) => e.targetNormalized));
    const missing = Object.entries(SPOKEN_FORMS).filter(([, formal]) => !known.has(formal));
    expect(missing).toEqual([]);
  });

  it("gives every form the pronunciation it will be shown with", () => {
    // The app has no audio, so this line is the only pronunciation a learner
    // gets for the spoken register.
    const noTranslit = Object.keys(SPOKEN_FORMS).filter((f) => !SPOKEN_TRANSLIT[f]);
    expect(noTranslit).toEqual([]);
  });

  it("resolves the forms that nothing else claims", () => {
    for (const [spoken, formal] of Object.entries(SPOKEN_FORMS)) {
      if (CONTESTED_SPOKEN.has(spoken)) continue;
      expect(index.resolve(spoken)?.targetNormalized, spoken).toBe(formal);
    }
  });

  it("knows exactly which forms a real entry already claims", () => {
    // If a new spoken form collides with a lexicon entry it does nothing at
    // all, silently. This makes that a failing test instead.
    const collides = Object.entries(SPOKEN_FORMS)
      .filter(([spoken, formal]) => index.resolve(spoken)?.targetNormalized !== formal)
      .map(([spoken]) => spoken);
    expect(new Set(collides)).toEqual(CONTESTED_SPOKEN);
  });

  it("does not rewrite a word the lexicon states outright", () => {
    // A text about weather must keep resolving مه as weather.
    expect(index.resolve("مه")?.glossEn).toContain("fog");
    expect(index.resolve("رستن")?.targetNormalized).toBe("رستن");
    expect(index.resolve("بردن")?.targetNormalized).toBe("بردن");
  });

  it("reads the Kabuli plural, which formal Dari writes with -ها", () => {
    expect(index.resolve("کتابا")?.targetNormalized).toBe("کتاب");
    expect(index.resolve("کتاب‌ها")?.targetNormalized).toBe("کتاب");
  });

  it("does not let the plural rule swallow words that merely end in alef", () => {
    // The rule only fires when what is left is a noun; without that guard it
    // would eat a large part of the verb paradigms.
    for (const word of ["آنها", "اینها", "تا", "با", "را"]) {
      const before = index.resolve(word);
      expect(before?.pos, word).not.toBe(undefined);
    }
  });

  it("offers a spoken form to show for the words that have one", () => {
    expect(spokenFormOf("رفتن")).toEqual({ target: "میرم", translit: "mērum" });
    expect(spokenFormOf("را")).toEqual({ target: "ره", translit: "ra" });
    // Most of the dictionary sounds the same in both registers; the line is
    // only worth showing where they actually differ.
    expect(spokenFormOf("کتاب")).toBeNull();
  });
});
