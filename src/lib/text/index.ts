import { profile } from "../lang/index.ts";

/**
 * Language-neutral text operations for the active build.
 *
 * Everything outside `src/lib/lang/` imports from here rather than from a
 * language's own module, so no call site names the language. Swapping the
 * target language swaps these implementations wholesale.
 *
 * The one thing that does NOT belong here is anything whose *behaviour* is
 * language-specific by design - verb paradigms, script normalization rules.
 * Those live in `src/lib/lang/<code>/` and are reached only through `profile`.
 */

/** Canonical, display-safe form. Both sides of a comparison must pass through this. */
export const normalize = profile.text.normalize;

/** Aggressive lookup key - normalize plus folding that only matching needs. */
export const matchKey = profile.text.matchKey;

/** Split running text into word tokens, dropping punctuation and whitespace. */
export const tokenize = profile.text.tokenize;

/** Build the surface→lexeme index for this language's morphology. */
export const buildIndex = profile.text.buildIndex;

export type { LexiconIndex } from "../lang/types.ts";
