import { lexiconIndex } from "../content/load";
import { tokenizeDari } from "../text/normalize";

/**
 * Token-level vocabulary validation for AI-generated Dari sentences. Checks
 * against the whole lexicon plus derivable verb forms, so unseen-but-real
 * words pass while hallucinated words and Iranian-Persian spellings reject.
 */

/**
 * The single acceptance rule for "is this a real Dari word form?". Everything
 * that validates Dari text - AI output, shipped content - goes through here, so
 * the corpus regression test in text/corpus.test.ts exercises exactly what
 * production does.
 *
 * This is deliberately the same resolver the reader uses for tap-to-lookup:
 * accepting a form the reader cannot explain is what let malformed verbs
 * (می‌کم، نامدم) reach learners. If it resolves, it is real and tappable; if it
 * does not, we must not put it in front of a user.
 */
export function isKnownToken(token: string): boolean {
  return lexiconIndex().resolve(token) !== null;
}

/** Throw unless every token of `target` is lexicon vocabulary or a taught form. */
export function assertKnownVocab(target: string, maxWords: number) {
  const tokens = tokenizeDari(target);
  if (tokens.length > maxWords) throw new Error(`Sentence too long: "${target}"`);
  for (const token of tokens) {
    if (!isKnownToken(token)) throw new Error(`Unknown word "${token}" in "${target}"`);
  }
}
