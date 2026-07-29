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

/**
 * Below this many tracked words, a learner's word list is too thin to measure a
 * text against: the placement credits them with hundreds, but only the handful
 * the assessment showed them exist as rows. The generator applies the same floor
 * when it chooses what vocabulary to write with. It lives here rather than in
 * `ai/generate.ts` because that module is server-only and this rule runs in the
 * browser - importing across that line fails the production build, though not
 * typecheck.
 */
export const ASSUMED_KNOWN_FLOOR = 15;

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
 * A learner placed above the first level has only the handful of words the
 * assessment happened to show them, not the several hundred the placement
 * credits them with. Under the floor, the level's prior words count as known -
 * the same fallback the generator makes when it chooses what to write.
 */
export function assumedKnown(
  trackedIds: readonly string[],
  priorIds: readonly string[],
): Set<string> {
  const known = new Set(trackedIds);
  if (known.size < ASSUMED_KNOWN_FLOOR) for (const id of priorIds) known.add(id);
  return known;
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
