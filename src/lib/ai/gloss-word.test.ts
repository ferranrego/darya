import { describe, expect, it, vi } from "vitest";
import { TRANSLITERATED } from "./lang-format.ts";

/** `completeJson` is stubbed: it spends a budget shared with real learners. */
const calls: { prompt: string; opts: { validate: (raw: string) => unknown } }[] = [];
vi.mock("./providers.ts", () => ({
  completeJson: (prompt: string, opts: { validate: (raw: string) => unknown }) => {
    calls.push({ prompt, opts });
    return Promise.resolve(null);
  },
  deadlineIn: (ms: number) => Date.now() + ms,
}));

const { glossWord, lemmaMatchesSurface } = await import("./gloss-word.ts");

async function capture() {
  calls.length = 0;
  await glossWord({ surface: "xyz", sentence: "A sentence with xyz in it." });
  return calls[0];
}

describe("glossWord prompt", () => {
  it("gives the model the sentence as a disambiguator", async () => {
    const { prompt } = await capture();
    expect(prompt).toContain("A sentence with xyz in it.");
    expect(prompt).toContain("many words have several");
  });

  it("asks for the dictionary form, not the tapped form", async () => {
    expect((await capture()).prompt).toContain("not the inflected form");
  });

  /**
   * Two questions, not one. Asked only "is this a proper noun?", a model
   * looking at the middle word of a personal name says yes, and the learner who
   * tapped it is told there is nothing to learn - when the word is an ordinary
   * noun whose meaning is exactly what they wanted.
   */
  it("asks the two name questions separately", async () => {
    const { prompt } = await capture();
    expect(prompt).toContain('"usedAsName"');
    expect(prompt).toContain('"isOnlyName"');
    expect(prompt).toContain("separate questions");
    expect(prompt).not.toContain('"isName"');
  });

  it("asks for JSON", async () => {
    expect((await capture()).prompt).toContain("JSON");
  });

  it("asks for a present stem only where the language is transliterated", async () => {
    const { prompt } = await capture();
    expect(prompt.includes('"presentStem"')).toBe(TRANSLITERATED);
  });
});

/**
 * A wrong entry is worse than a missing one: this is the only path that creates
 * a dictionary entry at runtime, so what the model returns is checked before it
 * becomes one.
 */
describe("glossWord validator", () => {
  const t = TRANSLITERATED ? { translit: "xyz" } : {};

  async function validate(payload: unknown) {
    const { opts } = await capture();
    return () => opts.validate(JSON.stringify(payload));
  }

  it("accepts an ordinary gloss", async () => {
    expect(await validate({ lemma: "xyz", glossEn: "a thing", pos: "noun", ...t })).not.toThrow();
  });

  it("rejects a gloss that is really a definition", async () => {
    const long = "a word which refers to the general concept of a thing that is somewhat like another";
    expect(await validate({ lemma: "xyz", glossEn: long, pos: "noun", ...t })).toThrow(/prose/);
  });

  it("rejects a single token claimed to be a phrase", async () => {
    expect(await validate({ lemma: "xyz", glossEn: "a thing", pos: "phrase", ...t })).toThrow(/phrase/);
  });

  it("rejects a response with no gloss", async () => {
    expect(await validate({ lemma: "xyz", pos: "noun", ...t })).toThrow();
  });

  it("rejects an invented part of speech", async () => {
    expect(await validate({ lemma: "xyz", glossEn: "a thing", pos: "widget", ...t })).toThrow();
  });

  it("defaults both name flags to false", async () => {
    const { opts } = await capture();
    const parsed = opts.validate(
      JSON.stringify({ lemma: "xyz", glossEn: "a thing", pos: "noun", ...t }),
    ) as { usedAsName: boolean; isOnlyName: boolean };
    expect(parsed.usedAsName).toBe(false);
    expect(parsed.isOnlyName).toBe(false);
  });

  // The shape the whole redesign exists to allow: a real word that happens to
  // be sitting inside somebody's name. It must still produce a usable entry.
  it("accepts a word that is both an ordinary word and part of a name", async () => {
    const check = await validate({
      lemma: "xyz",
      glossEn: "king",
      pos: "noun",
      usedAsName: true,
      isOnlyName: false,
      ...t,
    });
    expect(check).not.toThrow();
  });
});

/**
 * The model sometimes answers about a different, more familiar word than the
 * one it was asked about. Inflection changes endings far more than beginnings
 * in both languages here, so a shared opening is the cheap check.
 */
describe("lemmaMatchesSurface", () => {
  it("accepts an identical form", () => {
    expect(lemmaMatchesSurface("casa", "casa")).toBe(true);
  });

  it("accepts an inflection of the same word", () => {
    expect(lemmaMatchesSurface("dimitir", "dimiteixen")).toBe(true);
    expect(lemmaMatchesSurface("خانه", "خانه‌ها")).toBe(true);
  });

  it("rejects an unrelated word", () => {
    expect(lemmaMatchesSurface("govern", "dimiteixen")).toBe(false);
    expect(lemmaMatchesSurface("کتاب", "مردم")).toBe(false);
  });

  it("is lenient for very short words", () => {
    expect(lemmaMatchesSurface("va", "van")).toBe(true);
  });
});
