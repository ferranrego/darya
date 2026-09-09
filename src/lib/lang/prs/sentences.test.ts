import { describe, expect, it } from "vitest";
import { splitSentencesDari as split } from "./sentences.ts";

describe("splitSentencesDari", () => {
  it("splits on the Latin and Arabic full stops", () => {
    expect(split("خانه بزرگ است. دریا آبی است۔ او آمد.")).toHaveLength(3);
  });

  it("splits on the Arabic question mark", () => {
    expect(split("شما چطور هستید؟ من خوب هستم.")).toEqual([
      "شما چطور هستید؟",
      " من خوب هستم.",
    ]);
  });

  // The mistake that turns a normal paragraph into fragments: the Arabic comma
  // and semicolon are not sentence terminators.
  it("does not split on the Arabic comma or semicolon", () => {
    expect(split("نان، چای، و شکر؛ همه را خریدم.")).toHaveLength(1);
  });

  it("does not split a decimal written in Persian digits", () => {
    expect(split("قیمت آن ۳.۵ افغانی بود.")).toHaveLength(1);
  });

  it("does not split an initial", () => {
    expect(split("م. کریمی دیروز صحبت کرد.")).toHaveLength(1);
  });

  /**
   * Readability's textContent concatenates block elements with no separator, so
   * a headline runs straight into the next block. An entire BBC article once
   * arrived as six sentences because of it, the first 379 characters long.
   */
  it("splits a terminator welded to the next block", () => {
    expect(split("سرنوشت پرونده او چه شد؟مشاهده نسخه متنی از این مطلب.")).toHaveLength(2);
    expect(split("او آمد۔دیگری رفت.")).toHaveLength(2);
  });

  it("still does not split a Latin full stop with no space", () => {
    // Excluded on purpose: there it can be a decimal, an abbreviation or a URL.
    expect(split("بروید به bbc.com/dari و بخوانید.")).toHaveLength(1);
  });


  /**
   * Extracted articles arrive one line per block element, so a line break ends
   * a sentence whether or not it is punctuated. Without this an unpunctuated
   * furniture line - "view the text version of this article" - was welded onto
   * the body sentence after it, and the pair went to the translator together.
   */
  it("treats a line break as a sentence boundary", () => {
    const parts = split("مشاهده نسخه متنی از این مطلب\nاز ترور او ۲۵ سال می‌گذرد.");
    expect(parts).toHaveLength(2);
    expect(parts[1].trim()).toBe("از ترور او ۲۵ سال می‌گذرد.");
  });

  it("loses no text across line breaks", () => {
    const input = "خط اول\nخط دوم. جمله سوم.\n\nخط چهارم";
    expect(split(input).join("")).toBe(input);
  });

  it("hard-wraps an unpunctuated wall of text", () => {
    const wall = Array.from({ length: 150 }, () => "کلمه").join(" ");
    const parts = split(wall);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(400);
  });

  it("preserves ZWNJ inside a word", () => {
    const s = "من می‌روم به خانه. او می‌آید.";
    expect(split(s).join("")).toBe(s);
    expect(split(s)[0]).toContain("می‌روم");
  });

  it("loses no text", () => {
    const inputs = [
      "خانه بزرگ است. دریا آبی است۔ او آمد.",
      "نان، چای، و شکر؛ همه را خریدم. قیمت آن ۳.۵ افغانی بود.",
      Array.from({ length: 150 }, () => "کلمه").join(" "),
    ];
    for (const input of inputs) expect(split(input).join("")).toBe(input);
  });
});
