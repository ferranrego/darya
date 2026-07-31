/**
 * How much of a text is allowed to be new.
 *
 * This is the pedagogical contract of the whole product, so it lives in one
 * place rather than as a magic number in the generator and another in the
 * reader. Reading acquires vocabulary only when comprehension is high enough
 * that the unknown words can be inferred from context; the usual figure is
 * 95-98% of running words already known. Below that the learner is decoding,
 * not acquiring, and the failure is silent - the text looks fine and simply
 * does not teach.
 *
 * Both thresholds used to be a single `MAX_OOV_RATE = 0.25`, duplicated in
 * `ai/generate.ts` and `content/text-pool.ts`. That was wrong twice over: 25%
 * unknown is far past the point where reading stops working, and the two copies
 * were not even measuring the same thing.
 *
 * ## The two rates are not interchangeable
 *
 * `MAX_OOV_TOKEN_RATE` counts *running words*: every occurrence, so a known
 * word repeated five times counts five times. This is the rate the acquisition
 * research is stated in, and the one the generator checks.
 *
 * `MAX_OOV_TYPE_RATE` counts *distinct lexemes*: `vocabUsed`, where a word
 * counts once however often it appears. Known words repeat and new words
 * usually do not, so the type rate of a given text is always the higher of the
 * two. Applying the token threshold to a type count would reject texts that are
 * comfortably readable, which is how the reader ends up with an empty pool and
 * a permanent "Writing your next text…".
 *
 * The type rate is therefore set looser than the token rate deliberately. It is
 * a coarse gate on already-generated text; the token rate is the real contract.
 */

/**
 * Share of a generated text's *running words* that may be outside the
 * learner's vocabulary. The comprehensible-input threshold.
 */
export const MAX_OOV_TOKEN_RATE = 0.05;

/**
 * Share of a text's *distinct lexemes* that may be new before it is offered.
 * Looser than the token rate by construction - see the note above.
 */
export const MAX_OOV_TYPE_RATE = 0.12;

/**
 * A text with nothing new in it has nothing to teach, so the pool requires at
 * least this many unknown lexemes as well as at most `MAX_OOV_TYPE_RATE`.
 */
export const MIN_NEW_LEXEMES = 2;

/**
 * The type rate texts cached before `newWords` existed are judged by.
 *
 * Those texts have no record of which words they meant to teach, so every
 * unknown lexeme counts as difficulty - which is exactly what the old single
 * `MAX_OOV_RATE = 0.25` measured, and the rule they were accepted under.
 * Judging them by the new, tighter type rate instead would silently drop every
 * cached text between 12% and 25% from every learner's pool, while the
 * generate route still counted them as unread: the stuck reader, arriving by a
 * different door.
 *
 * It is deliberately the old number and not a tuned one. It should fall out of
 * use as those texts are read.
 */
export const LEGACY_MAX_OOV_TYPE_RATE = 0.25;
