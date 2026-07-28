import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isKnownToken } from "../ai/vocab-check.ts";
import { profile } from "../lang/index.ts";
import { tokenize } from "./index.ts";

/**
 * Corpus-level guard on the verb morphology.
 *
 * Unit tests check individual paradigms; this checks the thing that actually
 * matters - that the Dari we ship is recognised by the same acceptance rule the
 * app uses at runtime (`isKnownToken`). It is deliberately coupled to production
 * rather than to a private copy of the logic, so refactors of the morphology
 * engine are measured against real content instead of against themselves.
 *
 * The budget is a ratchet: it may fall, never rise. The handful of remaining
 * failures are genuine out-of-lexicon vocabulary, not morphology bugs.
 */

// content/active, not a hardcoded language: the acceptance rule under test
// belongs to the *active* profile, so reading another language's content would
// tokenize it with the wrong engine and report every word as unknown. That is
// exactly the bug this file exists to catch, one level up.
const CONTENT = join(import.meta.dirname, "..", "..", "..", "content", "active");
// Any letter in any script: the previous Perso-Arabic-only filter silently
// discarded every Catalan token, leaving nothing to assert on.
const HAS_LETTER = /\p{L}/u;

/** Every target-language string in a content file, wherever it is nested. */
function collectTarget(node: unknown, out: string[]): void {
  if (Array.isArray(node)) {
    for (const child of node) collectTarget(child, out);
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "string") {
      if (key === "target" || key === "answer" || key === "titleTarget") out.push(value);
    } else {
      collectTarget(value, out);
    }
  }
}

function corpus(): string[] {
  const out: string[] = [];
  for (const dir of [join(CONTENT, "grammar"), join(CONTENT, "texts", "seed")]) {
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      collectTarget(JSON.parse(readFileSync(join(dir, file), "utf8")), out);
    }
  }
  return out;
}

describe("shipped content is recognised by the runtime acceptance rule", () => {
  const strings = corpus();
  const tokens = strings
    .flatMap((s) => tokenize(s))
    .filter((t) => t !== "___" && HAS_LETTER.test(t));

  it("reads a non-trivial corpus", () => {
    expect(strings.length).toBeGreaterThan(0);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("does not regress the count of unrecognised tokens", () => {
    const unknown = tokens.filter((t) => !isKnownToken(t));

    // Per-language ratchet: may fall, never rise.
    //
    // prs was 192 until 36 lexemes that existed only in the database were
    // restored to content/ - they were the vocabulary the C1/C2 lessons use.
    // ca is higher *as a share* simply because its lexicon is 250 words against
    // Dari's 6000; it tightens as the lexicon grows.
    const BUDGET: Record<string, number> = { prs: 5, ca: 40 };
    const budget = BUDGET[profile.code] ?? 0;
    expect(unknown.length, `unresolved tokens for "${profile.code}"`).toBeLessThanOrEqual(budget);
  });
});
