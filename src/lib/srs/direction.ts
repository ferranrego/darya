/**
 * Which way round a flashcard is asked, and how the answer is given.
 *
 * Recognition and production are different skills, and this app has only ever
 * measured the first. A card that shows the Dari and asks "do you remember
 * this?" is answered by a learner grading themselves with the answer already
 * on screen; a card that gives the English and the sentence they met it in,
 * and asks them to write the Dari, cannot be.
 *
 * Nothing here touches the FSRS scheduler. The intervals are evidence about
 * memory and stay exactly as they are - this decides what is asked at a review
 * that was already due, not when the review happens.
 */
import { State, type Card } from "ts-fsrs";

export type Direction = "recognition" | "production";

/**
 * How the learner gives a Dari answer.
 *
 * `tiles` offers the letters or words to arrange; `typing` is a text box.
 * Typing is much stronger recall, but an Afghan-script keyboard on a phone is
 * a real barrier, and a beginner who cannot answer at all stops answering. So
 * tiles are the default at the first two levels and typing from the third -
 * with typing always available to anyone who wants it, at any level, because
 * the learner who has installed a Dari keyboard should never be held back by a
 * default written for the learner who has not.
 */
export type InputMode = "tiles" | "typing";

/**
 * Reviews a word must survive before it is asked for production.
 *
 * A word met once and immediately demanded back is a test of the last ten
 * seconds, not of memory, and failing it teaches nothing except that the app
 * is unfair. Two successful recognitions is the smallest number that means
 * "this has been seen on a separate day and come back" under FSRS's own
 * short-term steps.
 */
export const PRODUCTION_AFTER_REVIEWS = 2;

/**
 * Whether this card should ask the learner to write the word.
 *
 * Production is asked once a word is genuinely in the review state and has
 * survived a couple of recognitions, and it keeps being asked until it has
 * been produced correctly at least once. After that the two alternate, so a
 * word that was produced months ago is still occasionally demanded back rather
 * than coasting on one success.
 */
export function directionFor(
  card: Card,
  producedCount: number,
  /** Rotates the alternation so a whole session is not one direction. */
  seed: number,
): Direction {
  // A word still in its first learning steps is not a production candidate:
  // it has not yet been away long enough for recall to mean anything. Nor is a
  // lapsed one - a word that has just been forgotten is being re-learned, and
  // demanding it back on the spot is the same unfairness as demanding a new
  // one, with the added cost that the learner has already failed it today.
  if (card.state !== State.Review) return "recognition";
  if (card.reps < PRODUCTION_AFTER_REVIEWS) return "recognition";
  // Never produced: keep asking until it has been, because that is the
  // evidence "known" is about to start requiring.
  if (producedCount === 0) return "production";
  return seed % 2 === 0 ? "production" : "recognition";
}

/** Levels where tiles are the default, because typing Dari on a phone is not free. */
const TILE_DEFAULT_LEVELS = new Set(["L1", "L2"]);

/**
 * The input mode a learner starts with at this level.
 *
 * A starting point, not a restriction: the UI lets them switch to typing at
 * any level, and remembers it.
 */
export function defaultInputMode(level: string | null | undefined): InputMode {
  return level && TILE_DEFAULT_LEVELS.has(level) ? "tiles" : "typing";
}

/**
 * Whether a correct production should now count this word as produced.
 *
 * A word arranged from tiles is weaker evidence than one typed from nothing -
 * the letters were given - but it is still production, and requiring typing
 * would make the requirement unreachable for exactly the beginners it is meant
 * to protect. Both count; the script and the mode are recorded so the
 * difference stays measurable rather than assumed.
 */
export function countsAsProduced(verdict: string): boolean {
  return verdict === "correct";
}
