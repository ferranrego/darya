/**
 * Which texts a learner should be offered next.
 *
 * This is the client half of a two-sided contract. The server writes a text
 * against a vocabulary it believes the learner knows; this decides whether the
 * learner is allowed to see it. When the two halves disagree the failure is
 * silent and total: every generated text is rejected, the pool looks empty, the
 * reader sits on "Writing your next text…" and asks for another one on each
 * visit. It is pulled out of the page so the agreement can be asserted in a
 * test rather than discovered in production.
 */

import {
  LEGACY_MAX_OOV_TYPE_RATE,
  MAX_OOV_TYPE_RATE,
  MIN_NEW_LEXEMES,
} from "./difficulty.ts";

/**
 * The lexemes a placement credits a learner with, minus the ones they already
 * track.
 *
 * `entryKnownWords` is the number of words needed to *be* at a level, so the
 * learner's own level is the right threshold. Reading it off the level below
 * credited an L2 learner with L1's figure - zero - which left the reader with
 * nothing it would show and no way out of "Writing your next text…".
 */
export function placementCredit(
  entryKnownWords: number,
  lexemes: readonly { id: string; freqRank: number }[],
  trackedIds: readonly string[],
): string[] {
  const tracked = new Set(trackedIds);
  return lexemes
    .filter((e) => e.freqRank <= entryKnownWords && !tracked.has(e.id))
    .map((e) => e.id);
}

export interface PoolText {
  id: string;
  source: string;
  /** `newWords` is absent on texts cached before the field existed. */
  doc: { vocabUsed: string[]; newWords?: string[] };
}

export interface PoolInput {
  texts: PoolText[];
  /** Text ids the learner has already finished. */
  readIds: ReadonlySet<string>;
  /** Lexeme ids the learner has actually tracked (status known or learning). */
  trackedIds: readonly string[];
  /**
   * Lexeme ids below the learner's level that the placement implies they know
   * but which have no row yet - see PriorWordsSheet.
   */
  priorIds: readonly string[];
  /** The text open right now, which must not vanish mid-read. */
  activeTextId?: string | null;
  /**
   * For brand-new learners, the server assumes knowledge of the most frequent
   * words in their level band to bootstrap generation. The client must mirror
   * these to avoid rejecting the text as completely unknown.
   */
  fallbackIds?: readonly string[];
}

/**
 * The vocabulary a text is measured against.
 *
 * Tracked words, plus the words below the learner's level. The second part is
 * not a guess: being placed at a level *means* the vocabulary of the levels
 * beneath it is already known - that is what `entryKnownWords` says. Only the
 * few dozen words the assessment happened to show ever become rows, so counting
 * rows alone would treat a learner credited with 700 words as knowing 17, mark
 * ordinary level-appropriate text as too hard, and leave the reader with
 * nothing to show.
 *
 * PriorWordsSheet is what later turns the assumption into real rows, so the
 * words also enter the review queue. This decides difficulty; that decides
 * scheduling.
 */
export function assumedKnown(
  trackedIds: readonly string[],
  priorIds: readonly string[],
  fallbackIds?: readonly string[],
): Set<string> {
  return new Set([...trackedIds, ...priorIds, ...(fallbackIds ?? [])]);
}

export function selectUnread(input: PoolInput): PoolText[] {
  const known = assumedKnown(input.trackedIds, input.priorIds, input.fallbackIds);

  return input.texts
    .filter((t) => !input.readIds.has(t.id))
    .filter((t) => {
      // Seed texts are hand-checked against the lexicon, so they always pass.
      if (t.source === "seed") return true;
      if (t.id === input.activeTextId) return true;

      const vocab = t.doc.vocabUsed;
      const unknown = vocab.filter((w) => !known.has(w));

      // A word the text was written to teach is not what makes it hard - it is
      // the point of the text. Both counts below are over distinct lexemes, not
      // running words, so they use the type threshold - see content/difficulty.ts.
      //
      // `newWords` is absent on texts cached before the field existed. Those
      // keep the original measure, where an unknown word counts as difficulty
      // *and* as something learned. It is cruder - it cannot tell a word the
      // text meant to teach from one that leaked in - but it is the rule those
      // texts were accepted under, and re-judging them by a rule they were
      // never written to satisfy would empty the pool for existing learners.
      const declared = t.doc.newWords;
      const taught = declared ? unknown.filter((w) => declared.includes(w)) : unknown;
      const untaught = declared ? unknown.filter((w) => !declared.includes(w)) : unknown;

      const rate = vocab.length > 0 ? untaught.length / vocab.length : 0;
      const limit = declared ? MAX_OOV_TYPE_RATE : LEGACY_MAX_OOV_TYPE_RATE;
      // It must teach something, or there is nothing to read it for.
      return rate <= limit && taught.length >= MIN_NEW_LEXEMES;
    })
    .sort((a, b) => (a.source === b.source ? 0 : a.source === "seed" ? -1 : 1));
}
