import { describe, expect, it } from "vitest";

import { hubEntries } from "../content/grammar-hub.ts";
import { GRAMMAR_LEVEL_ORDER } from "../content/cefr.ts";
import { foldLatin, searchHub } from "./search.ts";

/**
 * The people who search the hub mostly do not know what a rule is called, and
 * spell it the way they heard it. A search that only finds "ezafe" when typed
 * "ezafe" fails exactly the learner it exists for - and fails silently, with a
 * friendly empty state.
 */
const top = (q: string) => searchHub(q, hubEntries)[0]?.entry.slug;

describe("grammar hub search", () => {
  it("finds a rule under the names and misspellings learners use", () => {
    for (const q of ["ezafe", "Ezāfa", "hezafe", "izafat", "ezafee", "EZAFE "]) {
      expect(top(q), q).toBe("ezafe");
    }
  });

  it("finds the present tense from the prefix however it is typed", () => {
    for (const q of ["mē-", "me", "mi-", "present tense"]) {
      expect(top(q), q).toBe("present-tense");
    }
  });

  it("matches Dari script", () => {
    expect(top("را")).toBe("object-marker-ra");
    expect(top("می")).toBe("present-tense");
  });

  it("finds each A1 page from the plain English a beginner would type", () => {
    const cases: Record<string, string> = {
      "to be": "pronouns-and-to-be",
      "word order": "word-order",
      plural: "plurals",
      "where": "questions",
      "didn't": "negation",
      "my": "possessive-endings",
      "with": "prepositions",
      "there is": "there-is-and-to-have",
      "past tense": "simple-past",
    };
    for (const [q, slug] of Object.entries(cases)) expect(top(q), q).toBe(slug);
  });

  it("does not forgive typos on short words, where one letter is a different rule", () => {
    // "na" is negation, "ra" is the object marker: one edit apart, never the same page.
    expect(searchHub("na", hubEntries).map((h) => h.entry.slug)).not.toContain("object-marker-ra");
  });

  it("returns nothing for nothing", () => {
    expect(searchHub("", hubEntries)).toEqual([]);
    expect(searchHub("   ", hubEntries)).toEqual([]);
    expect(searchHub("quantum chromodynamics", hubEntries)).toEqual([]);
  });

  it("folds Latin input down to plain lowercase words", () => {
    expect(foldLatin("Mē-khānam!")).toBe("me khanam");
  });
});

describe("grammar hub book order", () => {
  it("lists pages by level, then by usefulness", () => {
    for (let i = 1; i < hubEntries.length; i++) {
      const a = hubEntries[i - 1];
      const b = hubEntries[i];
      const byLevel = GRAMMAR_LEVEL_ORDER.indexOf(a.level) - GRAMMAR_LEVEL_ORDER.indexOf(b.level);
      expect(byLevel < 0 || (byLevel === 0 && a.rank < b.rank), `${a.slug} before ${b.slug}`).toBe(true);
    }
  });
});
