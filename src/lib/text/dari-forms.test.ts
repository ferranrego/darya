import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LexiconEntry } from "../content/schema.ts";
import { SUPPLETIVE_FORMS } from "./dari-forms.ts";
import { buildLexiconIndex } from "./lexicon-index.ts";
import { matchKey, ZWNJ } from "./normalize.ts";

/**
 * These assertions used to run against `buildAllowedFormKeys`, a second
 * morphology engine that scraped stems out of `variants`. That engine accepted
 * ~73% of forms the reader could not resolve, including malformed ones, so it
 * was deleted. The linguistic expectations survive unchanged - they are now
 * checked through `resolve()`, the single engine.
 */

function verb(
  id: string,
  target: string,
  presentStem?: string,
  freqRank = 1,
): LexiconEntry {
  return {
    id,
    target,
    targetNormalized: target,
    translit: "x",
    glossEn: "x",
    pos: "verb",
    freqRank,
    freqBand: 1,
    register: "neutral",
    variants: [],
    presentStem,
    exampleTarget: "x",
    exampleTranslit: "x",
    exampleEn: "x",
    tags: [],
  } as unknown as LexiconEntry;
}

describe("verb forms resolve through the single engine", () => {
  const idx = buildLexiconIndex([
    verb("lx-1", "رفتن", "رو"),
    verb("lx-2", "آمدن", "آ", 2),
    verb("lx-3", "کردن", "کن", 3),
    verb("lx-4", "دیدن", "بین", 4),
    verb("lx-5", "بودن", undefined, 5),
    verb("lx-6", "توانستن", "توان", 6),
  ]);
  const hits = (form: string) => idx.resolve(form)?.target ?? null;

  it("keeps A1 present and simple past", () => {
    expect(hits(`می${ZWNJ}روم`)).toBe("رفتن");
    expect(hits("رفتم")).toBe("رفتن");
    expect(hits("رفت")).toBe("رفتن");
  });

  it("keeps the subjunctive / imperative (be-) and its negative", () => {
    expect(hits("بروم")).toBe("رفتن");
    expect(hits("برو")).toBe("رفتن"); // bare imperative
    expect(hits("نرو")).toBe("رفتن"); // negative imperative
    expect(hits("نروم")).toBe("رفتن");
  });

  it("keeps the past participle and perfect enclitics", () => {
    expect(hits("رفته")).toBe("رفتن");
    expect(hits(`رفته${ZWNJ}ام`)).toBe("رفتن");
    expect(hits(`نرفته${ZWNJ}اید`)).toBe("رفتن");
  });

  it("uses the irregular subjunctive for āmadan, not *beāy", () => {
    expect(hits("بیاید")).toBe("آمدن");
    expect(hits("آمده")).toBe("آمدن"); // regular participle
    expect(hits("بآید")).toBeNull();
  });

  it("resolves budan's suppletive present and subjunctive", () => {
    expect(hits("هستم")).toBe("بودن");
    expect(hits("هست")).toBe("بودن");
    expect(hits("نیست")).toBe("بودن");
    // The paradigm that was missing entirely before this change.
    expect(hits("باشم")).toBe("بودن");
    expect(hits("باشند")).toBe("بودن");
    expect(hits("نباشیم")).toBe("بودن");
  });

  it("resolves the impersonal mē-tawān in both spellings", () => {
    expect(hits(`می${ZWNJ}توان`)).toBe("توانستن");
    expect(hits("میتوان")).toBe("توانستن");
  });

  it("rejects the malformed forms the old scraper accepted", () => {
    // The scraper mis-stripped 3sg -د as the 3pl -ند on ن-final stems, so
    // می‌کند yielded stem "ک" and می‌بیند yielded "بی", generating these.
    for (const bogus of [`می${ZWNJ}کم`, `می${ZWNJ}بیم`, "ببیم", "نکی", `می${ZWNJ}زم`]) {
      expect(idx.resolve(bogus), bogus).toBeNull();
    }
    // ...while the correct forms of the same verbs still resolve.
    expect(hits(`می${ZWNJ}کند`)).toBe("کردن");
    expect(hits(`می${ZWNJ}کنم`)).toBe("کردن");
    expect(hits(`می${ZWNJ}بیند`)).toBe("دیدن");
  });
});

describe("SUPPLETIVE_FORMS integrity", () => {
  const lexicon = JSON.parse(
    readFileSync(
      join(import.meta.dirname, "..", "..", "..", "content", "lexicon", "lexicon.json"),
      "utf8",
    ),
  ) as { entries: LexiconEntry[] };

  it("every lemma it points at exists as a real headword", () => {
    const headwords = new Set(lexicon.entries.map((e) => matchKey(e.targetNormalized)));
    for (const lemma of new Set(Object.values(SUPPLETIVE_FORMS))) {
      expect(headwords.has(matchKey(lemma)), `missing lemma ${lemma}`).toBe(true);
    }
  });

  it("resolves every one of its forms against the real lexicon", () => {
    const idx = buildLexiconIndex(lexicon.entries);
    for (const form of Object.keys(SUPPLETIVE_FORMS)) {
      expect(idx.resolve(form), form).not.toBeNull();
    }
  });
});
