import { describe, expect, it } from "vitest";

import { lexicon, lexiconIndex } from "../content/load.ts";
import { checkAnswer, foldLatin } from "./answer-check.ts";

/**
 * Run the grader over the entire dictionary, not over fixtures.
 *
 * This grades what a learner writes, so a defect here does not crash or look
 * wrong - it marks a right answer wrong, or a wrong answer right, and the
 * learner concludes they misremembered. The only check worth having is the one
 * the plan asked for: every valid form of every word accepted, near-misses
 * rejected, and no word's accepted answers colliding with a different word.
 */
const index = lexiconIndex();
const entries = lexicon.entries;

describe("grading a word the learner wrote", () => {
  it("accepts the Afghan-script headword of every entry in the dictionary", () => {
    const rejected = entries.filter((e) => checkAnswer(e.target, e, index).verdict !== "correct");
    // Printed rather than only counted: "3 of 6466" needs to name which three.
    if (rejected.length > 0) {
      console.log(`rejected own headword: ${rejected.slice(0, 10).map((e) => `${e.id} ${e.target}`).join(", ")}`);
    }
    expect(rejected).toHaveLength(0);
  });

  it("accepts the transliteration of every entry that has one", () => {
    const withTranslit = entries.filter((e) => e.translit);
    const rejected = withTranslit.filter((e) => checkAnswer(e.translit!, e, index).verdict !== "correct");
    if (rejected.length > 0) {
      console.log(`rejected own translit: ${rejected.slice(0, 10).map((e) => `${e.id} ${e.translit}`).join(", ")}`);
    }
    console.log(`graded ${entries.length} headwords and ${withTranslit.length} transliterations`);
    expect(rejected).toHaveLength(0);
  });

  it("accepts a transliteration typed without its macrons", () => {
    // Nobody types `khāna` on a phone keyboard. Failing an honest learner on
    // the app's own notation rather than on their Dari is the wrong trade.
    const entry = entries.find((e) => e.translit?.includes("ā"))!;
    const bare = entry.translit!.replace(/ā/g, "a").replace(/ī/g, "i").replace(/ū/g, "u");
    expect(checkAnswer(bare, entry, index).verdict).toBe("correct");
  });

  it("still refuses the Iranian vowel that the lexicon was repaired to remove", () => {
    // `dōst` folds to `dost`, so `dust` must not match. This is the single
    // defect PEDAGOGY.md §9 calls the top one; accepting it here would teach
    // the flattening back in through the answer box.
    const dost = entries.find((e) => e.translit === "dōst");
    expect(dost, "lexicon should still contain dōst").toBeDefined();
    expect(checkAnswer("dust", dost!, index).verdict).toBe("wrong");
    expect(checkAnswer("dost", dost!, index).verdict).toBe("correct");
    const sher = entries.find((e) => e.translit === "shēr");
    if (sher) expect(checkAnswer("shir", sher, index).verdict).toBe("wrong");
  });

  it("never accepts one word's headword as the answer to a different word", () => {
    /**
     * The `کار` / `کردن` hazard, checked across the whole dictionary.
     *
     * A grader that accepted a form belonging to another entry would teach a
     * wrong answer as right, and would do it silently. This walks every entry
     * and asserts that the *previous* entry's headword is never graded correct
     * for it - a cheap full-corpus sweep rather than a handful of examples.
     */
    const wrongly: string[] = [];
    for (let i = 1; i < entries.length; i++) {
      const asked = entries[i];
      const other = entries[i - 1];
      if (other.targetNormalized === asked.targetNormalized) continue; // genuine homographs
      if (checkAnswer(other.target, asked, index).verdict === "correct") {
        wrongly.push(`${other.target} (${other.id}) accepted for ${asked.target} (${asked.id})`);
      }
    }
    if (wrongly.length > 0) console.log(wrongly.slice(0, 10).join("\n"));
    expect(wrongly).toHaveLength(0);
  });

  it("tells a wrong form of the right word from a different word", () => {
    // `می‌روم` is a form of `رفتن`, so it is the right word inflected wrongly -
    // a correction, not a re-teaching. The distinction is the whole reason the
    // verdict has three values rather than two.
    const raftan = entries.find((e) => e.targetNormalized === "رفتن");
    expect(raftan, "lexicon should contain رفتن").toBeDefined();
    const check = checkAnswer("می‌روم", raftan!, index);
    expect(check.verdict).toBe("wrong-form");
    expect(check.script).toBe("target");
  });

  it("names the word a wrong answer actually was, so the learner can be told", () => {
    const raftan = entries.find((e) => e.targetNormalized === "رفتن")!;
    const khana = entries.find((e) => e.targetNormalized === "خانه")!;
    const check = checkAnswer(khana.target, raftan, index);
    expect(check.verdict).toBe("wrong");
    expect(check.resolvedTo?.id).toBe(khana.id);
  });

  it("accepts a headword typed without its zero-width joiner", () => {
    // 713 headwords contain a ZWNJ. It is invisible, absent from most phone
    // keyboards, and cannot be produced from letter tiles at all - so failing
    // on it would fail a learner on the app's encoding, not on their Dari.
    const withZwnj = entries.filter((e) => e.targetNormalized.includes("\u200c"));
    expect(withZwnj.length).toBeGreaterThan(100);
    const rejected = withZwnj.filter(
      (e) => checkAnswer(e.targetNormalized.replace(/\u200c/g, ""), e, index).verdict !== "correct",
    );
    if (rejected.length > 0) {
      console.log(`rejected ZWNJ-less: ${rejected.slice(0, 5).map((e) => e.target).join(", ")}`);
    }
    expect(rejected).toHaveLength(0);
  });

  it("treats an empty or whitespace answer as wrong rather than as a match", () => {
    const entry = entries[0];
    for (const blank of ["", "   ", "\n", "-", "'"]) {
      expect(checkAnswer(blank, entry, index).verdict, JSON.stringify(blank)).toBe("wrong");
    }
  });

  it("knows which script the learner answered in", () => {
    const entry = entries.find((e) => e.translit)!;
    expect(checkAnswer(entry.target, entry, index).script).toBe("target");
    expect(checkAnswer(entry.translit!, entry, index).script).toBe("latin");
  });
});

describe("folding a Latin answer", () => {
  it("drops macrons, case, spaces, hyphens and the ezafe apostrophe", () => {
    expect(foldLatin("KHĀNA")).toBe("khana");
    expect(foldLatin("ra'īs")).toBe("rais");
    expect(foldLatin("khāna-ye mā")).toBe("khanayema");
  });

  it("keeps the vowel quality that separates Dari from Iranian Persian", () => {
    expect(foldLatin("dōst")).not.toBe(foldLatin("dust"));
    expect(foldLatin("shēr")).not.toBe(foldLatin("shir"));
    expect(foldLatin("mērawad")).not.toBe(foldLatin("mirawad"));
  });
});
