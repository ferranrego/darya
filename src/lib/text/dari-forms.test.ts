import { describe, expect, it } from "vitest";
import type { LexiconEntry } from "../content/schema.ts";
import { buildAllowedFormKeys } from "./dari-forms.ts";
import { matchKey, ZWNJ } from "./normalize.ts";

function verb(id: string, dari: string, variants: string[]): LexiconEntry {
  return {
    id,
    dari,
    dariNormalized: dari,
    translit: "x",
    glossEn: "x",
    pos: "verb",
    freqRank: 1,
    freqBand: 1,
    register: "neutral",
    variants,
    exampleDari: "x",
    exampleTranslit: "x",
    exampleEn: "x",
    tags: [],
  } as LexiconEntry;
}

describe("buildAllowedFormKeys", () => {
  // raftan with a couple of present variants - the rest is derived.
  const keys = buildAllowedFormKeys([verb("lx-1", "رفتن", [`می${ZWNJ}روم`, `می${ZWNJ}رود`])]);
  const has = (form: string) => keys.has(matchKey(form));

  it("keeps A1 present and simple past", () => {
    expect(has(`می${ZWNJ}روم`)).toBe(true);
    expect(has("رفتم")).toBe(true);
    expect(has("رفت")).toBe(true);
  });

  it("adds the subjunctive / imperative (be-) and its negative", () => {
    expect(has("بروم")).toBe(true);
    expect(has("برو")).toBe(true); // bare imperative
    expect(has("نرو")).toBe(true); // negative imperative
    expect(has("نروم")).toBe(true);
  });

  it("adds the past participle and perfect enclitics", () => {
    expect(has("رفته")).toBe(true);
    expect(has(`رفته${ZWNJ}ام`)).toBe(true);
    expect(has(`نرفته${ZWNJ}اید`)).toBe(true);
  });

  it("includes irregular budan and khāhad-future forms", () => {
    expect(has("باشم")).toBe(true); // subjunctive of budan
    expect(has("خواهد")).toBe(true); // future
    expect(has("بوده")).toBe(true); // participle of budan
  });

  it("uses the irregular subjunctive for āmadan, not *beāy", () => {
    const amadan = buildAllowedFormKeys([verb("lx-2", "آمدن", [`می${ZWNJ}آید`])]);
    expect(amadan.has(matchKey("بیاید"))).toBe(true);
    expect(amadan.has(matchKey("آمده"))).toBe(true); // regular participle
    expect(amadan.has(matchKey("بآید"))).toBe(false);
  });
});
