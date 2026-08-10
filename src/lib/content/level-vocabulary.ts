/**
 * The vocabulary a level's texts are built from and measured against - the
 * level's, not any one learner's.
 *
 * Generation used to build a text against the *requesting learner's* tracked
 * words, then cache it in a pool every learner at that level shares. The
 * reader then measured the same text against its own, differently-derived
 * idea of what a beginner knows (`inBand.slice(0, 60)` vs the server's
 * `coldStartKnown`), and the two disagreed by construction - see the note on
 * `text-pool.ts`. A text generated against one canonical, level-wide
 * vocabulary cannot have this problem: every learner at the level is judging
 * it against the same set the writer used.
 *
 * `entryKnownWords` already means "the vocabulary needed to *be* at this
 * level" - `placementCredit` in `text-pool.ts` uses exactly this reading. This
 * is that same rule, made reusable outside the placement-credit path and
 * combined with the beginner core, which frequency rank alone does not reach
 * for the words a first text needs (`docs/PEDAGOGY.md` §5).
 */

import { BEGINNER_CORE_TAG } from "./word-selection.ts";
import type { LexiconEntry, Level } from "./schema.ts";

/**
 * In-band by frequency, plus the beginner core, unconditionally.
 *
 * Not gated to beginner levels: the core is a fixed ~500-word set and
 * `entryKnownWords` only grows, so once a level's band overtakes a core word
 * the union changes nothing for it - the two definitions coincide from
 * roughly A2+ (measured: 4 of 481 Catalan core words still sit outside the
 * band, even at C2). Applying it everywhere rather than special-casing "is
 * this a beginner level" is what makes the result provably monotone: a word
 * this function includes at one level is included at every level above it,
 * because `inBand` only grows and the core term never shrinks.
 */
export function levelVocabulary(
  level: Level,
  entries: readonly LexiconEntry[],
  isUsable: (e: LexiconEntry) => boolean,
): LexiconEntry[] {
  const inBand = entries.filter((e) => e.freqRank <= level.entryKnownWords && isUsable(e));
  const core = entries.filter((e) => e.tags.includes(BEGINNER_CORE_TAG) && isUsable(e));

  const seen = new Set<string>();
  const out: LexiconEntry[] = [];
  for (const e of [...inBand, ...core]) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out.sort((a, b) => a.freqRank - b.freqRank);
}
