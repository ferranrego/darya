import type { LexiconEntry } from "./schema.ts";

/**
 * Whether an entry is fit to be taught as a new word.
 *
 * Separate from the schema, which these entries all satisfy: the fields are
 * present and the right type, they just do not say anything. Bulk generation
 * passes left 290 Catalan entries whose gloss is the literal `[C2 auto-fill]`
 * with the headword echoed back as its own example, and 155 more whose English
 * example is the Catalan sentence prefixed `"Translated: "`. 366 of those sit
 * inside the B2 envelope, and 222 inside the first 1,700 words - so a beginner
 * meets them in their first weeks.
 *
 * Choosing one as a word to teach produces a prompt asking the model to weave
 * in `paraula ([C2 auto-fill])`, and a review card whose answer is a bracketed
 * editorial note. Excluding them costs a little vocabulary and is strictly
 * better than teaching them, which is the same judgement the entry generator
 * already makes: a wrong entry is worse than a missing one.
 *
 * These stay *resolvable* - a learner tapping one in an older text still gets
 * whatever the entry does say. This gates teaching, not lookup.
 *
 * The checks here are about data, not language, so they apply to both builds.
 * Catalan-specific defects (a noun tagged as an infinitive) live in
 * scripts/verify-ca-entries.ts, which has the morphology engine to judge them.
 */

/** Bracketed meta text standing in for a real gloss: "[C2 auto-fill]", "[TODO]". */
const PLACEHOLDER_GLOSS = /\[|auto-fill/i;

/**
 * An entry someone has deliberately ruled out as a headword.
 *
 * Written in the same bracketed shape, so it is excluded from teaching by the
 * check above without needing a schema field - but it is a decision that has
 * been made, not work still owed, and the two must not be counted together or
 * the repair burndown can never reach zero.
 */
const RULED_OUT = /^\[not a headword:/i;

export function isRuledOut(e: Pick<LexiconEntry, "glossEn">): boolean {
  return RULED_OUT.test(e.glossEn.trim());
}

export type TeachabilityDefect =
  | "placeholder-gloss"
  | "example-is-headword"
  | "untranslated-example"
  | "missing-example";

export function teachabilityDefects(e: LexiconEntry): TeachabilityDefect[] {
  const out: TeachabilityDefect[] = [];
  if (!e.glossEn.trim() || PLACEHOLDER_GLOSS.test(e.glossEn)) out.push("placeholder-gloss");

  const example = e.exampleTarget?.trim();
  if (!example) out.push("missing-example");
  // An "example" that is just the headword again teaches no usage at all.
  else if (example.normalize("NFC") === e.target.trim().normalize("NFC")) {
    out.push("example-is-headword");
  }

  if (/^\s*translated\s*:/i.test(e.exampleEn ?? "")) out.push("untranslated-example");
  return out;
}

export function isTeachable(e: LexiconEntry): boolean {
  return teachabilityDefects(e).length === 0;
}
