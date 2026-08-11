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
  MAX_OOV_TYPE_RATE_POOL,
  MIN_NEW_LEXEMES,
} from "./difficulty.ts";
import { levelVocabulary } from "./level-vocabulary.ts";
import type { LexiconEntry, Level } from "./schema.ts";

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
  /**
   * `newWords` is absent on texts cached before the field existed. `seq` is
   * the curriculum order within a level - present on seed texts built after
   * the 20260808000000 migration, absent on everything else (generated
   * texts, and seed texts cached before it).
   */
  doc: { vocabUsed: string[]; newWords?: string[]; seq?: number };
}

/**
 * The two jobs `knownIds` used to do at once, split apart.
 *
 * `assumedKnown` (below) answers one question - "what may appear in a text
 * without counting as difficulty" - by unioning tracked rows with the words
 * below the learner's level. That is right everywhere except L1, where
 * `entryKnownWords` is 0 and `placementCredit` therefore returns nothing:
 * `assumedKnown` collapses to "only what the learner has personally tapped",
 * while the prompt/scene vocabulary a fresh L1 learner is actually shown
 * comes from the ~430-480 word beginner core. Measured per semantic field,
 * 83-100% of that prompt slice sat outside `assumedKnown` for a new learner,
 * so L1 generation failed its own OOV gate almost every time.
 *
 * `KnownSets` names the two questions separately so each caller measures the
 * one it means:
 * - `coverage` - may this word appear in a text at this level without making
 *   it count as hard. Includes the level's whole curriculum vocabulary, not
 *   just what one learner has tracked, because being placed at a level means
 *   the vocabulary *of* that level is fair game to read.
 * - `familiar` - does *this learner* already have this word. Tracked rows
 *   plus placement credit, nothing more. This is what "did the text teach
 *   something new" must be measured against - crediting the whole level
 *   vocabulary here would make every L1 text teach nothing, because its
 *   target words are drawn from that same vocabulary.
 * - `placement` - the placement's un-rowed words, exposed only for
 *   PriorWordsSheet to turn into real rows. Never fed into `coverage` or
 *   `familiar` directly; both already include it via `familiar`.
 */
export interface KnownSets {
  /** Coverage: what may appear at this level without counting as difficulty. */
  coverage: ReadonlySet<string>;
  /** Familiar: what THIS learner has - tracked rows + placement credit. */
  familiar: ReadonlySet<string>;
  /** The placement's un-rowed words, for PriorWordsSheet only. */
  placement: string[];
}

/**
 * Builds both known sets for one learner at one level.
 *
 * `coverage` folds in `levelVocabulary` unconditionally, not just at the
 * levels where `placementCredit` is thin. Above L1 the two nearly coincide
 * (`placementCredit ≈ levelVocabulary`), so this changes nothing there; at
 * L1 it is the whole fix, and a single formula that does not special-case
 * "is this the first level" is what keeps the result monotone as
 * `trackedIds` grows - see the monotonicity test in text-pool.test.ts.
 */
export function knownSetsFor(input: {
  level: Level;
  entries: readonly LexiconEntry[];
  isUsable: (e: LexiconEntry) => boolean;
  trackedIds: readonly string[];
}): KnownSets {
  const placement = placementCredit(input.level.entryKnownWords, input.entries, input.trackedIds);
  const familiar = new Set([...input.trackedIds, ...placement]);
  const levelVocab = levelVocabulary(input.level, input.entries, input.isUsable).map((e) => e.id);
  const coverage = new Set([...familiar, ...levelVocab]);
  return { coverage, familiar, placement };
}

export interface PoolInput {
  texts: PoolText[];
  /** Text ids the learner has already finished. */
  readIds: ReadonlySet<string>;
  /** What this learner knows, split into the two questions `KnownSets` names. */
  known: KnownSets;
  /** The text open right now, which must not vanish mid-read. */
  activeTextId?: string | null;
  /** The next curriculum slot a beginner learner may read. */
  beginnerPosition?: number;
}

/**
 * Where a learner is in a beginner level's curriculum: one past the highest
 * `seq` they have read at this level, across both seed and generated texts.
 * The writer decides which slot to generate and the reader decides which slot
 * to offer from this same function, preventing another split contract.
 */
export function beginnerPositionFor(
  texts: readonly Pick<PoolText, "id" | "doc">[],
  readIds: ReadonlySet<string>,
): number {
  const readSeqs = texts
    .filter((t) => readIds.has(t.id))
    .map((t) => t.doc.seq)
    .filter((seq): seq is number => seq != null);
  return readSeqs.length > 0 ? Math.max(...readSeqs) + 1 : 1;
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
  const { coverage, familiar } = input.known;

  return input.texts
    .filter((t) => !input.readIds.has(t.id))
    .filter((t) => {
      // Seed texts are hand-checked against the lexicon, so they always pass.
      if (t.source === "seed") return true;
      if (t.id === input.activeTextId) return true;

      // A generated text ahead of this beginner's current curriculum slot may
      // be readable by the vocabulary gate below, but it assumes vocabulary
      // whose earlier introduction texts have not been read yet.
      if (input.beginnerPosition != null && t.doc.seq != null && t.doc.seq > input.beginnerPosition) {
        return false;
      }

      const vocab = t.doc.vocabUsed;
      // Difficulty is measured against `coverage`: what may appear at this
      // level without making the text count as hard.
      const unknown = vocab.filter((w) => !coverage.has(w));

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
      const untaught = declared ? unknown.filter((w) => !declared.includes(w)) : unknown;
      // "Taught" is measured against `familiar`, not `coverage`: whether the
      // text teaches something is about THIS learner, not about the level's
      // shared curriculum. Once the level's core vocabulary is inside
      // `coverage`, `unknown` (coverage-relative) shrinks a lot at beginner
      // levels - if `taught` were derived from that same shrunken `unknown`,
      // it would go empty for texts whose target words are core words, and
      // MIN_NEW_LEXEMES would reject every one of them. Using `familiar` here
      // is what keeps the two gates - "is this readable" and "does this
      // teach this learner something" - independent.
      const taught = declared ? declared.filter((w) => !familiar.has(w)) : unknown;

      const rate = vocab.length > 0 ? untaught.length / vocab.length : 0;
      const limit = declared ? MAX_OOV_TYPE_RATE_POOL : LEGACY_MAX_OOV_TYPE_RATE;
      // It must teach something, or there is nothing to read it for.
      return rate <= limit && taught.length >= MIN_NEW_LEXEMES;
    })
    .sort((a, b) => {
      if (a.source !== b.source) return a.source === "seed" ? -1 : 1;
      // Curriculum order: ascending `seq`, with anything missing one (legacy
      // generated rows and seed rows cached before ordering existed) last.
      const seqA = a.doc.seq;
      const seqB = b.doc.seq;
      if (seqA == null) return seqB == null ? 0 : 1;
      if (seqB == null) return -1;
      return seqA - seqB;
    });
}
