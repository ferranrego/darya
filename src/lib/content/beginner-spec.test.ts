import { describe, expect, it } from "vitest";
import { profile } from "../lang/index.ts";
import {
  closedClassOf,
  dimensionNames,
  dimensionOf,
  dimensionWords,
  fieldWords,
  isSpecTyped,
  semanticFieldNames,
  semanticFieldOf,
  verbFunctionNames,
  verbFunctionOf,
  verbFunctionWords,
} from "./beginner-spec.ts";
import { lexicon } from "./load.ts";
import { BEGINNER_CORE_TAG } from "./word-selection.ts";

/**
 * `beginner-spec.json` is 18 semantic fields, 10 verb functions and 26
 * descriptive dimensions of authored, reviewed content, and until now the
 * product asked it one question - "is this word beginner-core?" - and threw
 * the rest away. These assert the resolution actually recovers it, against
 * the real shipped content, for both languages.
 */
describe(`${profile.code} beginner-spec resolution`, () => {
  it("names at least the fields, functions and dimensions the spec declares", () => {
    expect(semanticFieldNames().length).toBeGreaterThanOrEqual(15);
    expect(verbFunctionNames().length).toBeGreaterThanOrEqual(8);
    expect(dimensionNames().length).toBeGreaterThanOrEqual(20);
  });

  it("resolves most semantic field seeds onto real lexicon entries", () => {
    // Compared against a generous floor rather than the exact seed count,
    // since a handful of seeds are legitimately unresolved in one language
    // (measured: 173/186 for Dari, 188/188 for Catalan).
    const resolved = semanticFieldNames().reduce((n, field) => n + fieldWords(field).length, 0);
    expect(resolved).toBeGreaterThan(150);
  });

  it("round-trips: a word tagged with a field is found by that field's word list", () => {
    for (const field of semanticFieldNames().slice(0, 3)) {
      for (const entry of fieldWords(field)) {
        expect(semanticFieldOf(entry.id)).toContain(field);
      }
    }
  });

  it("round-trips for verb functions and dimensions the same way", () => {
    for (const fn of verbFunctionNames().slice(0, 3)) {
      for (const entry of verbFunctionWords(fn)) {
        expect(verbFunctionOf(entry.id)).toContain(fn);
      }
    }
    for (const dim of dimensionNames().slice(0, 3)) {
      for (const entry of dimensionWords(dim)) {
        expect(dimensionOf(entry.id)).toContain(dim);
      }
    }
  });

  it("types a real closed-class word with more than one class where the language actually has overlap", () => {
    // Catalan `el` is both an article and a weak pronoun; Dari چند is both a
    // question word and a quantifier. A single-class answer would be wrong
    // for these, which is why closedClassOf returns an array.
    const overlapping = lexicon.entries.find((e) => closedClassOf(e.id).length > 1);
    expect(overlapping, "expected at least one lexeme in more than one closed class").toBeDefined();
  });

  it("types most of the beginner-core tag, which is the tag this replaces the sole use of", () => {
    const core = lexicon.entries.filter((e) => e.tags.includes(BEGINNER_CORE_TAG));
    const typed = core.filter((e) => isSpecTyped(e.id));
    // Not all of it: closed classes carry grammar the spec types but a few
    // corners (some `auto-added` entries) do not derive from this spec at
    // all. Most of the core should still resolve back to why it is core.
    expect(typed.length / core.length).toBeGreaterThan(0.7);
  });

  it("keeps descriptive dimensions to words that actually describe - no function words", () => {
    // Dimensions are mostly adjectives, with a handful of descriptive nouns
    // (colour terms like "rosa") and adverbs (comparatives). What they must
    // never contain is a closed-class word - that would mean the frame
    // engine could fill an [ADJ.dimension] slot with "de" or "que".
    const CONTENT_POS = new Set(["adjective", "noun", "adverb", "verb"]);
    for (const dim of dimensionNames()) {
      for (const entry of dimensionWords(dim)) {
        expect(CONTENT_POS.has(entry.pos), `${entry.id} (${entry.target}, pos=${entry.pos}) tagged for dimension "${dim}"`).toBe(true);
      }
    }
  });
});
