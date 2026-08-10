import { describe, expect, it } from "vitest";
import { COPULA, ezafe, pluralOf, presentIndicative, presentOfDashtan, withRa } from "./surface.ts";

/**
 * Every hazard the Dari philology review named for a slot-filling engine,
 * turned into an assertion - the same discipline `ca/surface.test.ts` follows.
 */
describe("ezafe", () => {
  it("consonant-final head: nothing written, translit gets -e", () => {
    // برادر من, never *برادرِ من - the vowel is real in speech and simply not
    // spelled. A filler that visibly marks every ezafe is already wrong here.
    const e = ezafe("برادر", "barādar");
    expect(e.target).toBe("برادر");
    expect(e.translit).toBe("barādar-e");
  });

  it("ا/و-final head: plain ی, translit gets -ye", () => {
    const e = ezafe("دنیا", "duniā");
    expect(e.target).toBe("دنیای");
    expect(e.translit).toBe("duniā-ye");
  });

  it("silent-he-final head: ZWNJ + ی, not a plain ی that would ligature into a different shape", () => {
    const e = ezafe("خانه", "khāna");
    expect(e.target).toBe("خانه‌ی");
    expect(e.translit).toBe("khāna-ye");
    // Without the ZWNJ the ه and ی would join into a medial-heh shape, which
    // is not what خانه‌ی is supposed to read as.
    expect(e.target).not.toBe("خانهی");
  });
});

describe("withRa", () => {
  it("marks a definite object, leaves a generic one bare", () => {
    // من سیب را می‌خورم (the apple - definite) vs از دکان نان می‌خرم (bread -
    // generic). را is a property of what the sentence means, never of the
    // noun, so both calls take the same noun and differ only in the flag.
    expect(withRa("سیب", "sēb", true)).toEqual({ target: "سیب را", translit: "sēb rā" });
    expect(withRa("نان", "nān", false)).toEqual({ target: "نان", translit: "nān" });
  });
});

describe("pluralOf", () => {
  it("defaults to ها, safe for both human and non-human nouns", () => {
    expect(pluralOf("کتاب", "kitāb").target).toBe("کتاب‌ها");
    expect(pluralOf("کتاب", "kitāb").translit).toBe("kitāb-hā");
  });

  it("uses the authored irregular over the default when one exists", () => {
    const p = pluralOf("مرد", "mard");
    expect(p.target).toBe("مردان");
    expect(p.target).not.toBe("مرد‌ها");
  });
});

describe("presentIndicative", () => {
  it("matches the seed text's own attested form: پدر به کار می‌رود / padar ba kār mērawad", () => {
    const v = presentIndicative("رفتن", "3sg");
    expect(v.target).toBe("می‌رود");
    expect(v.translit).toBe("mērawad");
  });

  it("conjugates all three persons with the same stem", () => {
    expect(presentIndicative("خوردن", "1sg")).toEqual({ target: "می‌خورم", translit: "mēkhoram" });
    expect(presentIndicative("خوردن", "2sg")).toEqual({ target: "می‌خوری", translit: "mēkhorē" });
    expect(presentIndicative("خوردن", "3sg")).toEqual({ target: "می‌خورد", translit: "mēkhorad" });
  });

  it("throws for a verb with no authored present stem, rather than guess", () => {
    expect(() => presentIndicative("خندیدن", "3sg")).toThrow(/no presentStem\/translit authored/);
  });
});

describe("presentOfDashtan", () => {
  it("is bare دار+ending, never می‌دار - the suppletive exception noMiPresent exists for", () => {
    const p1 = presentOfDashtan("1sg");
    expect(p1.target).toBe("دارم");
    expect(p1.target).not.toContain("می");
    expect(p1.translit).toBe("dāram");
    expect(presentOfDashtan("3sg")).toEqual({ target: "دارد", translit: "dārad" });
  });
});

describe("COPULA", () => {
  it("is the fixed 3sg است, not conjugated from بودن's past stem", () => {
    expect(COPULA["3sg"]).toEqual({ target: "است", translit: "ast" });
  });
});
