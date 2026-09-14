import { describe, expect, it } from "vitest";
import { COPULA, ezafe, pluralOf, presentIndicative, presentOfDashtan, withRa } from "./surface.ts";
import { lexicon } from "../../content/load.ts";

/** Real, authored lexicon entries - the fix must work on what is actually shipped, not a hand-typed stand-in. */
function entry(id: string) {
  const e = lexicon.entries.find((x) => x.id === id);
  if (!e) throw new Error(`fixture entry ${id} missing from the real lexicon - update this test's id`);
  return e;
}

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
    const v = presentIndicative({ target: "رفتن", presentStem: "رو", presentStemTranslit: "raw" }, "3sg");
    expect(v.target).toBe("می‌رود");
    expect(v.translit).toBe("mērawad");
  });

  it("conjugates all three persons with the same stem", () => {
    // Dari has u in khurdan (lx-0091's own stem is khur); khor is Iranian.
    const khurdan = { target: "خوردن", presentStem: "خور", presentStemTranslit: "khur" };
    expect(presentIndicative(khurdan, "1sg")).toEqual({ target: "می‌خورم", translit: "mēkhuram" });
    expect(presentIndicative(khurdan, "2sg")).toEqual({ target: "می‌خوری", translit: "mēkhurī" });
    expect(presentIndicative(khurdan, "3sg")).toEqual({ target: "می‌خورد", translit: "mēkhurad" });
  });

  it("writes the 2sg ending as long -ī, never the indefinite's -ē", () => {
    // The ی of می‌روی is the 2sg -ī the lexicon, course and hub all write;
    // -ē is the indefinite (khūbē). This table once said -ē.
    const v = presentIndicative({ target: "رفتن", presentStem: "رو", presentStemTranslit: "raw" }, "2sg");
    expect(v).toEqual({ target: "می‌روی", translit: "mērawī" });
    expect(v.translit).not.toMatch(/ē$/);
  });

  it("throws for a verb with no authored present stem, rather than guess", () => {
    expect(() => presentIndicative({ target: "خندیدن" }, "3sg")).toThrow(/no presentStem\/translit authored/);
  });

  // ---------------------------------------------------------------------
  // Regular verbs - controls. No compound, no prefix, no epenthesis: these
  // must render exactly as before the fix.
  // ---------------------------------------------------------------------

  it("کردن (lx-0097): plain present, no glide, no prefix, no carrier", () => {
    const v = presentIndicative(entry("lx-0097"), "3sg");
    expect(v.target).toBe("می‌کند");
    expect(v.translit).toBe("mēkunad");
  });

  it("رفتن (lx-0089): plain present, و-final stem that does NOT take the glide", () => {
    const v = presentIndicative(entry("lx-0089"), "3sg");
    expect(v.target).toBe("می‌رود");
    expect(v.translit).toBe("mērawad");
  });

  it("خوردن (lx-0091): conjugates all three persons, real authored stem translit (khur)", () => {
    const khordan = entry("lx-0091");
    expect(presentIndicative(khordan, "1sg")).toEqual({ target: "می‌خورم", translit: "mēkhuram" });
    expect(presentIndicative(khordan, "2sg")).toEqual({ target: "می‌خوری", translit: "mēkhurē" });
    expect(presentIndicative(khordan, "3sg")).toEqual({ target: "می‌خورد", translit: "mēkhurad" });
  });

  // ---------------------------------------------------------------------
  // The glide: vowel-final present stems need the epenthetic ی
  // (گو/جو take it; رو/شو/دو do not, despite also ending in و).
  // ---------------------------------------------------------------------

  it("گفتن (lx-0093): گو takes the glide - می‌گوید/mēgōyad, never می‌گود/mēgōad", () => {
    const v = presentIndicative(entry("lx-0093"), "3sg");
    expect(v.target).toBe("می‌گوید");
    expect(v.translit).toBe("mēgōyad");
  });

  it("آمدن (lx-0090): آ takes the glide - می‌آید/mēāyad, never می‌آد/mēāad", () => {
    const v = presentIndicative(entry("lx-0090"), "3sg");
    expect(v.target).toBe("می‌آید");
    expect(v.translit).toBe("mēāyad");
  });

  // ---------------------------------------------------------------------
  // Compound verbs: the carrier (دوست، بیدار) is invariant and must survive;
  // only the light verb (داشتن، شدن) conjugates.
  // ---------------------------------------------------------------------

  it("دوست داشتن (lx-6384): compound on داشتن keeps the carrier AND takes no می - دوست دارد, never *می‌دارد", () => {
    const v = presentIndicative(entry("lx-6384"), "3sg");
    expect(v.target).toBe("دوست دارد");
    expect(v.translit).toBe("dōst dārad");
    expect(v.target).not.toContain("می");
  });

  it("بیدار شدن (lx-6366): compound on شدن keeps the carrier - بیدار می‌شود/bēdār mēshawad, never mēshōad", () => {
    // The entry's own presentStemTranslit is authored as "shō" (a stale copy
    // of شدن's stem translit); VERB_OVERRIDES' own "shaw" must win, the same
    // way its presentStem already does.
    const v = presentIndicative(entry("lx-6366"), "3sg");
    expect(v.target).toBe("بیدار می‌شود");
    expect(v.translit).toBe("bēdār mēshawad");
    expect(v.translit).not.toBe("bēdār mēshōad");
  });

  // ---------------------------------------------------------------------
  // Prefixed verbs: the prefix attaches outside می، the verb never loses it.
  // ---------------------------------------------------------------------

  it("برگشتن (lx-6138): the بر prefix survives - برمی‌گردد, never *می‌گردد", () => {
    const v = presentIndicative(entry("lx-6138"), "3sg");
    expect(v.target).toBe("برمی‌گردد");
    expect(v.translit).toBe("barmēgardad");
    expect(v.target.startsWith("بر")).toBe(true);
  });
});

describe("presentOfDashtan", () => {
  it("is bare دار+ending, never می‌دار - the suppletive exception noMiPresent exists for", () => {
    const p1 = presentOfDashtan("1sg");
    expect(p1.target).toBe("دارم");
    expect(p1.target).not.toContain("می");
    expect(p1.translit).toBe("dāram");
    expect(presentOfDashtan("2sg")).toEqual({ target: "داری", translit: "dārī" });
    expect(presentOfDashtan("3sg")).toEqual({ target: "دارد", translit: "dārad" });
  });
});

describe("COPULA", () => {
  it("is the fixed 3sg است, not conjugated from بودن's past stem", () => {
    expect(COPULA["3sg"]).toEqual({ target: "است", translit: "ast" });
  });
});
