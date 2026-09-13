import { describe, expect, it } from "vitest";

import { hubEntries } from "../content/grammar-hub.ts";
import { searchHub } from "./search.ts";

/**
 * B2 pages are found by what the construction means in English, not by its
 * Dari name: a learner looking for kāsh types "I wish". Kept apart from
 * search.test.ts so a level's pages can be added without touching the others'.
 */
const top = (q: string) => searchHub(q, hubEntries)[0]?.entry.slug;

describe("grammar hub search, B2", () => {
  it("finds each B2 page from the plain English a learner would type", () => {
    const cases: Record<string, string> = {
      "if I had known": "unreal-conditionals",
      "I wish": "wishes",
      "must have": "perfect-subjunctive",
      although: "concessive",
      until: "temporal-connectors",
      colloquial: "spoken-vs-written",
      "one can": "impersonal",
      gerund: "verbal-nouns",
    };
    for (const [q, slug] of Object.entries(cases)) expect(top(q), q).toBe(slug);
  });

  it("still sends the everyday modal to the A2 page, not to 'must have'", () => {
    expect(top("must")).toBe("want-can-must");
  });

  it("finds B2 pages from their Dari keywords", () => {
    expect(top("کاش")).toBe("wishes");
    expect(top("رفته باشد")).toBe("perfect-subjunctive");
  });
});
