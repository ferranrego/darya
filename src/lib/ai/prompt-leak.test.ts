import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * No prompt in `src/lib/ai/` may name a language.
 *
 * This directory is shared by every build. `generate.ts` was written to route
 * language-specific wording through `profile.prompts`; nothing else was, so the
 * Catalan build spent months asking models for sentences "idiomatic in Dari",
 * for "valid Dari words", for a "menu or sign in Dari", and for an explanation
 * of the Catalan sentence's "ezafe chains". None of it failed loudly - the
 * model simply complied, and the learner was taught the result.
 *
 * The regression is invisible in the Dari build, which is what let it survive.
 * A grep is the cheapest thing that catches it, so it runs in CI.
 */

const AI_DIR = join(import.meta.dirname);

/**
 * `alphabet-reading.ts` is exempt by construction: it teaches the Perso-Arabic
 * script to non-readers, is gated on `capabilities.scriptCourse`, and never
 * loads in a Latin-script build. Its prompt names Dari on purpose.
 */
const EXEMPT = new Set(["alphabet-reading.ts"]);

/** Language names and language-specific jargon that must not be hardcoded. */
const FORBIDDEN = [
  "Dari",
  "Persian",
  "Catalan",
  "Afghan",
  "Kabuli",
  "Iranian",
  "ezafe",
  "Ezafe",
];

/**
 * Strip comments before scanning. A comment explaining *why* a guard exists
 * frequently has to name the language - that is documentation, not a prompt,
 * and forbidding it would delete the reasoning this codebase depends on.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function sourceFiles(): string[] {
  return readdirSync(AI_DIR).filter(
    (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !EXEMPT.has(f),
  );
}

describe("AI prompts are language-neutral", () => {
  for (const file of sourceFiles()) {
    it(`${file} names no language outside comments`, () => {
      const code = stripComments(readFileSync(join(AI_DIR, file), "utf8"));
      const found = FORBIDDEN.filter((word) => new RegExp(`\\b${word}\\b`).test(code));
      expect(
        found,
        `${file} hardcodes ${found.join(", ")}. Route it through ` +
          `profile.prompts.* or LANGUAGE_NAME from ./lang-format.ts instead.`,
      ).toEqual([]);
    });
  }

  it("finds the modules it is supposed to be guarding", () => {
    // A rename or a move must not silently reduce this suite to zero files.
    const files = sourceFiles();
    expect(files).toContain("exercises.ts");
    expect(files).toContain("grammar-practice.ts");
    expect(files).toContain("context-sentences.ts");
    expect(files).toContain("explain.ts");
    expect(files).toContain("generate.ts");
  });
});
