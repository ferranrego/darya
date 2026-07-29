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

export interface PoolText {
  id: string;
  source: string;
  doc: { vocabUsed: string[] };
}

/** Share of a text's vocabulary that may be new before it is too hard. */
const MAX_OOV_RATE = 0.25;

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
): Set<string> {
  return new Set([...trackedIds, ...priorIds]);
}

export function selectUnread(input: PoolInput): PoolText[] {
  const known = assumedKnown(input.trackedIds, input.priorIds);

  return input.texts
    .filter((t) => !input.readIds.has(t.id))
    .filter((t) => {
      // Seed texts are hand-checked against the lexicon, so they always pass.
      if (t.source === "seed") return true;
      if (t.id === input.activeTextId) return true;

      const vocab = t.doc.vocabUsed;
      const oov = vocab.reduce((n, w) => n + (known.has(w) ? 0 : 1), 0);
      const rate = vocab.length > 0 ? oov / vocab.length : 0;
      // At least one new word, or there is nothing to learn from it.
      return rate <= MAX_OOV_RATE && oov >= 1;
    })
    .sort((a, b) => (a.source === b.source ? 0 : a.source === "seed" ? -1 : 1));
}
