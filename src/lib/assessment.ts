import { FREQ_BAND_COUNT, type LexiconEntry } from "./content/schema";
import { availableLevels } from "./content/load";

/**
 * Level assessment: sample words across frequency bands, estimate vocabulary
 * size from per-band recognition rates, pick a starting level, and decide
 * which words to seed as known.
 */

/** How many words the placement shows before the dynamic spawner takes over. */
const INITIAL_SEED_SIZE = 32;

/**
 * Which band each seeded word is drawn from, weighted toward the common end.
 *
 * Derived from `FREQ_BAND_COUNT` rather than written out. The literal it
 * replaces listed bands 11 and 12, which do not exist in a ten-band lexicon:
 * those four slots silently produced nothing, so the placement asked 31
 * questions instead of 35 *and* the surviving weights were the ones written for
 * a twelve-band scale, over-sampling band 1. Both errors pushed the estimate
 * down, and a learner placed below their level is shown texts they find
 * trivial.
 *
 * More samples at the common end is deliberate and not a bug: that is where the
 * level boundaries are packed together, so that is where a wrong answer moves
 * the estimate most.
 */
function seedBandSchedule(): number[] {
  const weights = Array.from({ length: FREQ_BAND_COUNT }, (_, i) => 1 / Math.sqrt(i + 1));
  const total = weights.reduce((n, w) => n + w, 0);
  const out: number[] = [];
  weights.forEach((w, i) => {
    const count = Math.max(1, Math.round((w / total) * INITIAL_SEED_SIZE));
    for (let n = 0; n < count; n++) out.push(i + 1);
  });
  return out;
}

const INITIAL_SEED_BANDS = seedBandSchedule();

/**
 * Bands with recognition at or above this are counted toward the estimate.
 *
 * This used to also seed every word in the band as known, which is where the
 * invented vocabulary came from: a learner claiming 80% of a band had the
 * other 20% marked known on no evidence, by design, for every band they
 * cleared. Bands run past a thousand words, so an honest learner clearing the
 * first six had roughly 500 words they never claimed silently added - words
 * that never entered the review system and still counted toward promotion.
 * Seeding is now governed by `bandsFullyCleared` below; this threshold decides
 * only how far the estimate reaches.
 */
const BAND_KNOWN_THRESHOLD = 0.8;

/**
 * Share of control words a learner may tap before nothing is credited.
 *
 * Controls are invented words: tapping one cannot be knowledge. A couple of
 * taps is a slip or a genuine false memory - a real effect in vocabulary
 * testing, not dishonesty - so the estimate is corrected rather than thrown
 * away. Above this, the claims carry no information at all and nothing is
 * seeded: the learner starts at the first level and reviews their way up,
 * which costs an over-claimer some easy reviews and costs an honest learner
 * nothing, because an honest learner does not reach it.
 */
export const OVERCLAIM_LIMIT = 0.25;

export interface AssessmentWord {
  entry: LexiconEntry;
  band: number;
}

/**
 * One invented word shown in the grid.
 *
 * Deliberately not a `LexiconEntry`: a control must never be able to reach
 * `user_words`, whose `lexeme_id` is a foreign key to a real lexeme. Keeping
 * the types apart is what makes that impossible rather than merely unlikely.
 */
export interface ControlWord {
  target: string;
  translit: string;
  band: number;
}

export function getInitialSeed(entries: LexiconEntry[], excludeIds?: Set<string>): AssessmentWord[] {
  const out: AssessmentWord[] = [];
  for (const band of INITIAL_SEED_BANDS) {
    const candidates = entries.filter(e => 
      e.freqBand === band && 
      e.pos !== "particle" && e.pos !== "conjunction" && e.pos !== "preposition" &&
      (!excludeIds || !excludeIds.has(e.id))
    );
    if (candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      out.push({ entry: candidates[idx], band });
    }
  }
  return out;
}

export function spawnRelatedWords(
  tappedBand: number,
  entries: LexiconEntry[],
  excludeIds: Set<string>
): AssessmentWord[] {
  const out: AssessmentWord[] = [];
  // Spawn 3 words. To probe higher levels, we pick from band, band+1, band+2 (capped at max band).
  const targetBands = [
    tappedBand,
    Math.min(tappedBand + 1, FREQ_BAND_COUNT),
    Math.min(tappedBand + 2, FREQ_BAND_COUNT)
  ];
  
  for (const band of targetBands) {
    const candidates = entries.filter(e => 
      e.freqBand === band && 
      e.pos !== "particle" && e.pos !== "conjunction" && e.pos !== "preposition" &&
      !excludeIds.has(e.id)
    );
    if (candidates.length > 0) {
      const idx = Math.floor(Math.random() * candidates.length);
      out.push({ entry: candidates[idx], band });
      excludeIds.add(candidates[idx].id); // prevent picking same word twice in this spawn loop
    }
  }
  return out;
}

export interface AssessmentResult {
  estimatedVocab: number;
  levelId: string;
  /** Lexeme IDs to seed as `known`. */
  knownLexemeIds: string[];
  /**
   * Lexeme IDs to put into the review system rather than credit outright.
   *
   * The topmost band the learner fully cleared. They very likely do know these
   * - but "very likely" is what the old rule said about 500 words, so these
   * get checked instead of assumed. Reviewing a word you know costs one tap.
   */
  learningLexemeIds: string[];
  /** Share of invented words tapped, 0 when none were shown. */
  overclaimRate: number;
  /** True when the claims carried too little information to credit anything. */
  overclaimed: boolean;
}

/**
 * Score the placement.
 *
 * Three things changed here, and all three exist because the old rule credited
 * vocabulary nobody claimed:
 *
 *  - **Control words.** Invented words mixed into the grid. Tapping one cannot
 *    be knowledge, so the share tapped is a direct measure of over-claiming,
 *    and the per-band rates are corrected by it using the standard
 *    guessing correction for a yes/no vocabulary test: what survives is the
 *    recognition that the false-alarm rate cannot explain.
 *  - **Only fully-cleared bands are credited.** A band where every sampled
 *    word was recognised, with every easier band also fully cleared. The old
 *    rule credited a whole band on 80%, inventing the other 20% - at band
 *    sizes past a thousand words.
 *  - **The topmost cleared band is reviewed, not assumed.** Those words enter
 *    the SRS as learning. The learner almost certainly knows them; "almost
 *    certainly" is exactly what was claimed about the 500 invented ones.
 */
export function scoreAssessment(
  sampled: AssessmentWord[],
  selectedIds: Set<string>,
  allEntries: LexiconEntry[],
  /** Invented words shown, and which of them were tapped. */
  controls: { shown: readonly ControlWord[]; tapped: number } = { shown: [], tapped: 0 },
): AssessmentResult {
  const perBand = new Map<number, { hit: number; total: number }>();
  for (const w of sampled) {
    const s = perBand.get(w.band) ?? { hit: 0, total: 0 };
    s.total++;
    if (selectedIds.has(w.entry.id)) s.hit++;
    perBand.set(w.band, s);
  }

  const overclaimRate = controls.shown.length === 0 ? 0 : controls.tapped / controls.shown.length;
  const overclaimed = overclaimRate > OVERCLAIM_LIMIT;

  /**
   * Correct a recognition rate for over-claiming.
   *
   * The standard correction for a yes/no vocabulary test: subtract the
   * false-alarm rate and rescale, leaving the recognition that guessing cannot
   * account for. A learner who tapped no invented words is unaffected, which
   * is the property that matters - this must never cost an honest learner
   * anything.
   */
  const corrected = (rate: number): number => {
    if (overclaimRate <= 0) return rate;
    if (overclaimRate >= 1) return 0;
    return Math.max(0, (rate - overclaimRate) / (1 - overclaimRate));
  };

  // Estimate against the actual lexicon: recognition rate per band times the
  // band's real entry count. This puts the estimate on the same scale as the
  // levels' entryKnownWords rank cutoffs, so every level is reachable.
  const bandSizes = new Array<number>(FREQ_BAND_COUNT).fill(0);
  for (const e of allEntries) bandSizes[e.freqBand - 1]++;

  let estimatedVocab = 0;
  /**
   * The highest band where every sampled word was recognised, with every
   * easier band also fully cleared.
   *
   * "Fully", not 80%: the gap between those two numbers is precisely the
   * vocabulary the app used to invent. A run of lucky hits among rare words
   * cannot carry the long tail with it, because the prefix must hold.
   */
  let topClearedBand = 0;
  let prefixCleared = true;
  for (let band = 1; band <= FREQ_BAND_COUNT; band++) {
    const s = perBand.get(band);
    if (!s || s.total === 0) continue;
    const rate = corrected(s.hit / s.total);
    estimatedVocab += Math.round(rate * bandSizes[band - 1]);
    prefixCleared = prefixCleared && s.hit === s.total && !overclaimed;
    if (prefixCleared) topClearedBand = band;
  }

  // Words the learner tapped are always theirs: they claimed them one at a
  // time, which is the only evidence this test actually collects.
  const known = new Set<string>(selectedIds);
  const learning = new Set<string>();
  if (!overclaimed) {
    for (const e of allEntries) {
      if (e.freqBand < topClearedBand) known.add(e.id);
      else if (e.freqBand === topClearedBand) learning.add(e.id);
    }
  }
  // A word cannot be both; an explicit claim outranks a band-wide inference.
  for (const id of known) learning.delete(id);

  // Highest level whose entry threshold the learner clears - restricted to
  // availableLevels, the same list the reading level-up check and journey map
  // use. Scanning every level content defines let an over-confident or
  // fluent learner be placed at C1/C2 while those are unavailable (their
  // vocabulary isn't finished), and nothing downstream can promote a learner
  // out of an unavailable level, so `/api/generate` had no teachable words
  // left to draw from - a permanent dead end on the very first "Start
  // reading" tap, with no retake-assessment path to recover from it.
  let levelId = availableLevels[0].id;
  for (const level of availableLevels) {
    if (estimatedVocab >= level.entryKnownWords) levelId = level.id;
  }

  return {
    estimatedVocab,
    levelId,
    knownLexemeIds: [...known],
    learningLexemeIds: [...learning],
    overclaimRate,
    overclaimed,
  };
}
