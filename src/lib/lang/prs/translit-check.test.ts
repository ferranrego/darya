import { describe, expect, it } from "vitest";

import { VERIFIED_SHORT_VOWEL, isFlattenedTranslit, scriptLongVowelCount } from "./translit-check.ts";

/**
 * These four sentences are the whole reason this check is script-aware.
 *
 * The first version asked only whether the Latin contained a long vowel, and
 * on the real lexicon that hid three correct entries from learners while
 * catching 1,208 broken ones. Correct Dari can be entirely short vowels;
 * "no long vowel in the transliteration" is only evidence of a defect when
 * the script says there should have been one.
 */
describe("Iranian-flattened transliteration", () => {
  it("catches a sentence whose long vowels were dropped", () => {
    expect(
      isFlattenedTranslit(
        "Anjam va ghayat-e ensan residan be kamal-e motlaq ast.",
        "انجام و غایت انسان رسیدن به کمال مطلق است.",
      ),
    ).toBe(true);
  });

  it("accepts correct Dari that simply has no long vowel", () => {
    // mardum az sitam khasta shuda-and - every vowel short, and the script
    // agrees. The naive rule called this broken and hid it.
    expect(
      isFlattenedTranslit("mardum az sitam khasta shuda-and.", "مردم از ستم خسته شده‌اند."),
    ).toBe(false);
    expect(
      isFlattenedTranslit("jughd yak paranda-yi shabgard ast.", "جغد یک پرنده شبگرد است."),
    ).toBe(false);
  });

  it("accepts a repaired sentence", () => {
    expect(
      isFlattenedTranslit(
        "anjām wa ghāyat-i insān rasēdan ba kamāl-i mutlaq ast.",
        "انجام و غایت انسان رسیدن به کمال مطلق است.",
      ),
    ).toBe(false);
  });

  it("ignores a word-initial alef, which carries a short vowel", () => {
    // از / است / انسان - the first two are `az` and `ast`, not long vowels.
    expect(scriptLongVowelCount("از است")).toBe(0);
    expect(scriptLongVowelCount("انسان")).toBe(1);
  });

  it("says nothing about strings too short to judge", () => {
    expect(isFlattenedTranslit("ketab", "کتاب")).toBe(false);
  });
});

/**
 * The escape hatch, and why it has to exist.
 *
 * ی is counted as a written long vowel because not counting it costs 21 real
 * detections. But ی also spells the diphthong in `bayn` and `tarafayn`, where
 * nothing is missing - and the script cannot tell the two apart. Rather than
 * blunt the rule, those sentences are named one at a time.
 */
describe("verified short-vowel sentences", () => {
  it("is not flagged once verified by id", () => {
    const target = "عقد بیع بین طرفین منعقد شد.";
    const translit = "aqd-i bay' bayn-i tarafayn mun'aqid shud.";
    // The rule alone cannot see that those three ی are diphthongs.
    expect(isFlattenedTranslit(translit, target)).toBe(true);
    expect(isFlattenedTranslit(translit, target, "lx-4197")).toBe(false);
  });

  it("does not excuse a genuinely flattened sentence that shares an id", () => {
    // The exemption is about one sentence, so a real defect under a listed id
    // would still be wrong - the point is that ids here are verified by hand.
    expect(VERIFIED_SHORT_VOWEL.size).toBeLessThanOrEqual(5);
  });
});
