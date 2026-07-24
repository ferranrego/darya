import { lexicon, lexiconIndex } from "../content/load";
import { buildAllowedFormKeys } from "../text/dari-forms";
import { matchKey, tokenizeDari } from "../text/normalize";

/**
 * Token-level vocabulary validation for AI-generated Dari sentences. Checks
 * against the whole lexicon plus derivable verb forms, so unseen-but-real
 * words pass while hallucinated words and Iranian-Persian spellings reject.
 */

let allowedFormKeys: Set<string> | null = null;
function allowedForms(): Set<string> {
  allowedFormKeys ??= buildAllowedFormKeys(lexicon.entries);
  return allowedFormKeys;
}

/** Throw unless every token of `dari` is lexicon vocabulary or a taught form. */
export function assertKnownVocab(dari: string, maxWords: number) {
  const tokens = tokenizeDari(dari);
  if (tokens.length > maxWords) throw new Error(`Sentence too long: "${dari}"`);
  for (const token of tokens) {
    if (lexiconIndex().resolve(token)) continue;
    if (allowedForms().has(matchKey(token))) continue;
    throw new Error(`Unknown word "${token}" in "${dari}"`);
  }
}
