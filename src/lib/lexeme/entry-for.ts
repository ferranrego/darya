import { lexemeById } from "../content/lexicon";
import type { LexiconEntry } from "../content/schema";

/**
 * The shipped lexicon always wins.
 *
 * A personal entry is a model's guess at a lemma; a lexicon entry is reviewed
 * content. If a gloss ever mints a `ux-` row for a word that is really in the
 * lexicon, the curated entry must still be what the learner sees.
 */
export function entryFor(
  lexemeId: string,
  personal?: ReadonlyMap<string, LexiconEntry>,
): LexiconEntry | undefined {
  return lexemeById(lexemeId) ?? personal?.get(lexemeId);
}
