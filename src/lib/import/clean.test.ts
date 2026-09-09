import { describe, expect, it } from "vitest";
import { profile } from "../lang/index.ts";
import { cleanArticleText } from "./clean.ts";

/**
 * Written to pass in either build: branch on capabilities, never on a language
 * literal.
 */
describe("cleanArticleText", () => {
  it("removes non-breaking spaces and soft hyphens", () => {
    const out = cleanArticleText("This is a sen­tence that runs on long enough.");
    expect(out).not.toContain(" ");
    expect(out).not.toContain("­");
  });

  it("drops short unpunctuated furniture lines", () => {
    const out = cleanArticleText(
      ["Share", "Advertisement", "Home", "This is a real sentence of the article."].join("\n"),
    );
    expect(out).toBe("This is a real sentence of the article.");
  });

  it("keeps a short line that ends a sentence", () => {
    expect(cleanArticleText("He left.")).toBe("He left.");
  });

  it("collapses repeated lines", () => {
    const line = "This paragraph appears twice in the extracted markup.";
    expect(cleanArticleText([line, line].join("\n"))).toBe(line);
  });

  it("collapses runs of spaces and tabs", () => {
    expect(cleanArticleText("A    sentence   with  odd spacing throughout it.")).toBe(
      "A sentence with odd spacing throughout it.",
    );
  });

  // The one invisible character that must survive: ZWNJ joins letters in
  // Perso-Arabic script, and removing it makes a different, unresolvable word.
  it("preserves ZWNJ", () => {
    const withZwnj = "من می‌روم به خانه هستم و اینجا.";
    expect(cleanArticleText(withZwnj)).toContain("می‌روم");
  });

  it("preserves the Catalan interpunct", () => {
    const out = cleanArticleText("Vaig anar al col·legi amb els meus amics ahir.");
    expect(out).toContain("col");
    // The profile's own normalizer decides the canonical interpunct; whichever
    // it is, the two halves must not have been welded together.
    expect(out).not.toContain("collegi");
  });

  it("output is already normalized, so tokens will be findable in it", () => {
    const out = cleanArticleText("Some ordinary article text that is long enough to keep.");
    expect(profile.text.normalize(out)).toBe(out);
  });
});
