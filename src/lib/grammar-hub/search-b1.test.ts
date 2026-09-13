import { describe, expect, it } from "vitest";

import { hubEntries } from "../content/grammar-hub.ts";
import { searchHub } from "./search.ts";

/**
 * B1 pages are named after grammar a learner has usually met in English
 * lessons, not in Dari ones - "the subjunctive", "the passive" - so the query
 * that has to work is the plain English of what they are trying to say.
 */
const top = (q: string) => searchHub(q, hubEntries)[0]?.entry.slug;

describe("grammar hub search, B1", () => {
  it("finds each B1 page from the plain English a learner would type", () => {
    const cases: Record<string, string> = {
      maybe: "subjunctive",
      because: "conjunctions",
      nobody: "quantifiers",
      "the man who": "relative-clauses",
      if: "conditionals",
      before: "time-clauses",
      "he said": "reported-speech",
      "had gone": "past-perfect",
      "was written": "passive",
      suffix: "word-building",
    };
    for (const [q, slug] of Object.entries(cases)) expect(top(q), q).toBe(slug);
  });

  it("finds B1 pages from their Dari key words", () => {
    expect(top("شاید")).toBe("subjunctive");
    expect(top("اگر")).toBe("conditionals");
    expect(top("هیچ")).toBe("quantifiers");
  });

  it("finds B1 pages from transliterations typed without macrons", () => {
    expect(top("shayad")).toBe("subjunctive");
    expect(top("waqti ke")).toBe("time-clauses");
    expect(top("guft ke")).toBe("reported-speech");
  });
});
