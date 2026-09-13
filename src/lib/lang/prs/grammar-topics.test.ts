import { describe, expect, it } from "vitest";
import lexiconJson from "@content/lexicon/lexicon.json";
import { lexiconFileSchema, type LexiconEntry } from "../../content/schema.ts";
import { topicsForToken } from "./grammar-topics.ts";

/**
 * Real lexicon entries, not hand-built fixtures - a hand-built entry could
 * accidentally encode the assumption the function is being tested for (e.g.
 * a `presentStem` that happens to make the test pass). Loaded once and
 * looked up by headword, the same way `lexicon-index.ts` does.
 */
const entries = lexiconFileSchema.parse(lexiconJson).entries;
function headword(target: string): LexiconEntry {
  const e = entries.find((e) => e.targetNormalized === target);
  if (!e) throw new Error(`fixture headword not found in lexicon: ${target}`);
  return e;
}

const raftan = headword("رفتن"); // to go: presentStem رو, pastStem رفت
const khordan = headword("خوردن"); // to eat: presentStem خور, pastStem خورد (overlaps!)
const ketab = headword("کتاب"); // book (noun)
const nan = headword("نان"); // bread (noun, starts with ن)
const nam = headword("نام"); // name (noun, starts with ن)
const mewa = headword("میوه"); // fruit (noun, starts with می but no ZWNJ)
const mez = headword("میز"); // table (noun, starts with می but no ZWNJ)

describe("topicsForToken - must match", () => {
  it("را is the object marker", () => {
    expect(topicsForToken("را", null)).toContain("object-marker-ra");
  });

  it("می‌روم is present tense (رو fits present only)", () => {
    const topics = topicsForToken("می‌روم", raftan);
    expect(topics).toContain("present-tense");
    expect(topics).not.toContain("past-continuous");
  });

  it("نمی‌روم is present tense negation", () => {
    const topics = topicsForToken("نمی‌روم", raftan);
    expect(topics).toContain("negation");
    expect(topics).toContain("present-tense");
    expect(topics).not.toContain("past-continuous");
  });

  it("می‌رفتم is past continuous (رفت fits past only)", () => {
    const topics = topicsForToken("می‌رفتم", raftan);
    expect(topics).toContain("past-continuous");
    expect(topics).not.toContain("present-tense");
  });

  it("کتاب‌ها is plural", () => {
    expect(topicsForToken("کتاب‌ها", ketab)).toContain("plurals");
  });

  it("کتاب‌های is plural and ezafe", () => {
    const topics = topicsForToken("کتاب‌های", ketab);
    expect(topics).toContain("plurals");
    expect(topics).toContain("ezafe");
  });

  it("نرفتم is negation and simple past (رفت + م)", () => {
    const topics = topicsForToken("نرفتم", raftan);
    expect(topics).toContain("negation");
    expect(topics).toContain("simple-past");
  });
});

describe("topicsForToken - must NOT match", () => {
  it("a noun ending in ی or ها with no ZWNJ is not a plural", () => {
    // "کتابها" without the ZWNJ is a different (non-standard) spelling this
    // function must not guess at; only the ZWNJ-joined form is certain.
    expect(topicsForToken("کتابها", ketab)).not.toContain("plurals");
    expect(topicsForToken("کتابی", ketab)).not.toContain("plurals");
  });

  it("words that naturally start with ن are not negation", () => {
    expect(topicsForToken("نان", nan)).toEqual([]);
    expect(topicsForToken("نام", nam)).toEqual([]);
  });

  it("words that naturally start with می (no ZWNJ) are not present tense", () => {
    expect(topicsForToken("میوه", mewa)).toEqual([]);
    expect(topicsForToken("میز", mez)).toEqual([]);
  });

  it("an ambiguous می‌خورد (present and past stem overlap) gets no tense chip", () => {
    const topics = topicsForToken("می‌خورد", khordan);
    expect(topics).not.toContain("present-tense");
    expect(topics).not.toContain("past-continuous");
  });

  it("a verb-shaped surface with a non-verb entry matches nothing", () => {
    // کتاب is a noun; a verb-only reading must not fire just because the
    // surface happens to look like one.
    expect(topicsForToken("می‌روم", ketab)).toEqual([]);
    expect(topicsForToken("نرفتم", ketab)).toEqual([]);
  });

  it("a null entry matches nothing except the standalone را", () => {
    expect(topicsForToken("می‌روم", null)).toEqual([]);
    expect(topicsForToken("کتاب‌ها", null)).toEqual([]);
    expect(topicsForToken("نرفتم", null)).toEqual([]);
  });
});
