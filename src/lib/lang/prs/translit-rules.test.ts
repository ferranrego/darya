import { describe, expect, it } from "vitest";
import { normalizeTranslitDashes, translitProblems } from "./translit-rules.ts";

const rules = (t: string, target?: string) => translitProblems(t, target).map((p) => p.rule);

/**
 * The strings below are real rows from `lexeme_context_sentences` in
 * production, written by the provider chain with the orthography rules in
 * their prompt. They are the evidence that a prompt is not a check: 26 of the
 * 53 cached sentences break a convention the prompt states outright.
 */
describe("translitProblems, against real generated output", () => {
  it("catches mī- with a Unicode hyphen, which the gate's own /\\bmi-/ missed", () => {
    expect(rules("man be kār mī‐rom.")).toContain("me-prefix");
  });

  it("catches a ZWNJ sitting between the prefix and the hyphen", () => {
    expect(rules("man bā dustam mī‌-rom.")).toEqual(
      expect.arrayContaining(["me-prefix", "dost", "ascii-dash"]),
    );
  });

  it("catches the short e for a kasra", () => {
    expect(rules("in khāne kalān ast.")).toContain("short-e");
  });

  it("catches x for kh", () => {
    expect(rules("shāgird mē-shenāxt molām rā.")).toContain("kh-not-x");
  });

  it("accepts the sentences that were already correct", () => {
    for (const ok of [
      "u khāna rā tamīz mē-konad.",
      "khāna-yam khūb ast.",
      "in kitāb ast.",
      "subh havā sarad ast.",
    ]) {
      expect(translitProblems(ok)).toEqual([]);
    }
  });
});

/**
 * `\b` is ASCII-only in JavaScript, so it finds a word boundary between the ā
 * and the m of `rassāmī-ye` and calls a noun plus its ezafe a verb prefix.
 * Widening the gate's `mi-` test to cover `mī-` made that reachable, and it
 * fired on shipped lexicon entries the first time it ran against them.
 */
describe("word boundaries around long vowels", () => {
  it("does not read a verb prefix inside a word ending -mī", () => {
    expect(translitProblems("rassāmī-ye ō bisyār khūb ast.")).toEqual([]);
  });

  it("still catches a real prefix after a long vowel elsewhere", () => {
    expect(rules("ū mi-rawad")).toContain("me-prefix");
  });

  it("does not flag dust inside a longer word boundary-free context", () => {
    // `dust` as a prefix of the word is the error; the check anchors to a word
    // start so `dōstam` and unrelated words are untouched.
    expect(translitProblems("dōstam āmad")).toEqual([]);
  });
});

describe("normalizeTranslitDashes", () => {
  it("maps the dashes and joiners a model reaches for onto a plain hyphen", () => {
    expect(normalizeTranslitDashes("mī‐rom")).toBe("mī-rom");
    expect(normalizeTranslitDashes("mī‌-rom")).toBe("mī-rom");
  });

  it("leaves an ordinary hyphen alone", () => {
    expect(normalizeTranslitDashes("khāna-yam")).toBe("khāna-yam");
  });
});

/**
 * The final-yeh rule is the gate's, for grammar-hub content only. Run over the
 * lexicon it reports hundreds of reviewed, shipped entries, so it is opt-in:
 * a check that cries wolf at that volume trains people to ignore the output.
 */
describe("final-yeh is opt-in", () => {
  it("stays quiet by default on a shipped lexicon spelling", () => {
    expect(translitProblems("khayli")).toEqual([]);
  });

  it("reports when a caller asks for it", () => {
    expect(rules("khayli")).not.toContain("final-yeh");
    expect(translitProblems("khayli", undefined, { finalYeh: true }).map((p) => p.rule)).toContain(
      "final-yeh",
    );
  });
});
