import { describe, expect, it } from "vitest";
import { profile } from "../lang/index.ts";
import { grammarCourses, levels, lexicon } from "./load.ts";

/**
 * The content actually loaded must belong to the language actually selected.
 *
 * This exists because that was silently false. `@content` was a Turbopack
 * `resolveAlias`, which lost to tsconfig `paths`, so a Catalan build bundled the
 * Dari lexicon. Everything downstream looked healthy - the build succeeded, the
 * page title read "Riera · Learn Catalan", the CSS direction was `ltr` - and the
 * only thing wrong was every single word in the app.
 *
 * The lesson is in what the earlier checks measured: that the env var
 * propagated, and that the branding changed. Neither touched the content. So
 * this asserts the one fact that was wrong.
 */
describe("loaded content matches the active language", () => {
  it("lexicon declares the active language", () => {
    expect(lexicon.language).toBe(profile.code);
  });

  it("every grammar course declares the active language", () => {
    for (const course of grammarCourses) {
      expect(course.language, `${course.level}`).toBe(profile.code);
    }
  });

  it("headwords are written in the expected script", () => {
    const PERSO_ARABIC = /[؀-ۿ]/;
    const sample = lexicon.entries.slice(0, 200).map((e) => e.target);
    const arabicCount = sample.filter((w) => PERSO_ARABIC.test(w)).length;

    if (profile.dir === "rtl") {
      // Dari: essentially every headword is Perso-Arabic.
      expect(arabicCount, "expected Perso-Arabic headwords").toBeGreaterThan(150);
    } else {
      // A Latin-script language must contain none at all. This is the
      // assertion that fails when the wrong lexicon is bundled.
      expect(arabicCount, "Perso-Arabic headwords in a Latin-script build").toBe(0);
    }
  });

  it("levels are non-empty and the lexicon is substantial", () => {
    expect(levels.length).toBeGreaterThan(0);
    expect(lexicon.entries.length).toBeGreaterThan(100);
  });

  it("transliteration presence matches the profile's capability", () => {
    const withTranslit = lexicon.entries.filter((e) => e.translit).length;
    if (profile.capabilities.transliteration) {
      expect(withTranslit, "expected transliterations").toBeGreaterThan(0);
    } else {
      expect(withTranslit, "unexpected transliterations").toBe(0);
    }
  });
});
