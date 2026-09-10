import { describe, expect, it } from "vitest";
import { PROFILES } from "./index.ts";

/**
 * `verbHeadwordProblem` is the language's answer to "can the engine resolve
 * this verb entry at all?", and `scripts/validate-content.ts` is its only
 * caller. That script reports "All content valid" whether the rule fires or
 * not, so a rule that quietly stopped matching would look exactly like a clean
 * lexicon - the failure mode this repo keeps meeting. These cases pin the
 * behaviour in the direction that has no other witness: the words that must be
 * *rejected*.
 *
 * The cases are keyed by language code and only the codes actually registered
 * are run, so this file needs no edit when a deployment carries one language.
 */

const ZWNJ = "‌";

/** [headword, expected problem or null] */
const CASES: Record<string, [string, string | null][]> = {
  ca: [
    ["cantar", null],
    ["perdre", null],
    ["dormir", null],
    // Not an infinitive ending, so no conjugation can be derived. Shipping it
    // as pos="verb" would render fine and resolve none of its forms.
    ["casa", "has no conjugation spec"],
    ["blau", "has no conjugation spec"],
    // Worth knowing what this check does NOT catch: it is purely
    // morphological, so any word ending -ar/-er/-re/-ir reads as an
    // infinitive. `llibre` tagged pos="verb" passes here and would have to be
    // caught by review, not by the validator.
    ["llibre", null],
  ],
  prs: [
    ["کردن", null],
    // Compounds conjugate their light verb, which the space is what finds.
    ["کار کردن", null],
    // Finite forms and a modal, kept as standalone headwords on purpose.
    ["است", null],
    ["باشد", null],
    ["باید", null],
    [`استخدام${ZWNJ}کردن`, "is a compound verb joined with ZWNJ, use a space"],
    // A ZWNJ *inside* a part is legitimate when the compound has its space.
    [`هیجان${ZWNJ}زده شدن`, null],
    ["کتاب", "is not an infinitive"],
  ],
};

describe("verbHeadwordProblem", () => {
  for (const [code, profile] of Object.entries(PROFILES)) {
    const cases = CASES[code];
    if (!cases) continue;

    describe(code, () => {
      it("is on the profile", () => {
        expect(typeof profile.text.verbHeadwordProblem).toBe("function");
      });

      for (const [word, expected] of cases) {
        const label = expected === null ? "accepts" : `rejects (${expected})`;
        it(`${label}: ${word}`, () => {
          expect(profile.text.verbHeadwordProblem(word)).toBe(expected);
        });
      }
    });
  }

  it("covers every registered language", () => {
    for (const code of Object.keys(PROFILES)) {
      expect(CASES[code], `no cases for registered language "${code}"`).toBeDefined();
    }
  });
});
