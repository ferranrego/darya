import { describe, expect, it } from "vitest";
import { matchKey, normalizeDari, tokenizeDari, ZWNJ } from "./normalize.ts";

describe("normalizeDari", () => {
  it("folds Arabic yeh and kaf to Persian", () => {
    expect(normalizeDari("علي")).toBe("علی");
    expect(normalizeDari("كتاب")).toBe("کتاب");
  });

  it("preserves ZWNJ and alef madda", () => {
    expect(normalizeDari("می‌روم")).toContain(ZWNJ);
    expect(normalizeDari("آب")).toBe("آب");
  });

  it("strips tatweel", () => {
    expect(normalizeDari("بـــد")).toBe("بد");
  });
});

describe("matchKey", () => {
  it("strips diacritics and folds alef variants", () => {
    expect(matchKey("لطفاً")).toBe(matchKey("لطفا"));
    expect(matchKey("أب")).toBe(matchKey("اب"));
  });
});

describe("tokenizeDari", () => {
  it("splits a simple sentence and drops punctuation", () => {
    expect(tokenizeDari("خانه ما کلان است.")).toEqual(["خانه", "ما", "کلان", "است"]);
  });

  it("keeps ZWNJ compounds as single tokens", () => {
    const tokens = tokenizeDari("پدر به کار می‌رود.");
    expect(tokens).toEqual(["پدر", "به", "کار", `می${ZWNJ}رود`]);
  });

  it("handles Dari question and quote punctuation", () => {
    expect(tokenizeDari("تو کجا هستی؟")).toEqual(["تو", "کجا", "هستی"]);
    expect(tokenizeDari("«سلام» گفت.")).toEqual(["سلام", "گفت"]);
  });

  it("handles multiple ZWNJ compounds in one sentence", () => {
    const tokens = tokenizeDari("بچه‌ها بازی می‌کنند.");
    expect(tokens).toEqual([`بچه${ZWNJ}ها`, "بازی", `می${ZWNJ}کنند`]);
  });
});
