import { FREQ_BAND_COUNT, type LexiconEntry } from "./content/schema";
import { levels } from "./content/load";

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

/** Bands with recognition at or above this seed every core word as known. */
const BAND_KNOWN_THRESHOLD = 0.8;

export interface AssessmentWord {
  entry: LexiconEntry;
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
}

export function scoreAssessment(
  sampled: AssessmentWord[],
  selectedIds: Set<string>,
  allEntries: LexiconEntry[],
): AssessmentResult {
  const perBand = new Map<number, { hit: number; total: number }>();
  for (const w of sampled) {
    const s = perBand.get(w.band) ?? { hit: 0, total: 0 };
    s.total++;
    if (selectedIds.has(w.entry.id)) s.hit++;
    perBand.set(w.band, s);
  }

  // Estimate against the actual lexicon: recognition rate per band times the
  // band's real entry count. This puts the estimate on the same scale as the
  // levels' entryKnownWords rank cutoffs, so every level is reachable.
  const bandSizes = new Array<number>(FREQ_BAND_COUNT).fill(0);
  for (const e of allEntries) bandSizes[e.freqBand - 1]++;

  let estimatedVocab = 0;
  const known = new Set<string>(selectedIds);
  // Only seed a band wholesale when every easier band also cleared the
  // threshold: a few lucky hits among rare words shouldn't mark the whole
  // long tail as known.
  let prefixKnown = true;
  for (let band = 1; band <= FREQ_BAND_COUNT; band++) {
    const s = perBand.get(band);
    if (!s || s.total === 0) continue;
    const rate = s.hit / s.total;
    estimatedVocab += Math.round(rate * bandSizes[band - 1]);
    if (rate >= BAND_KNOWN_THRESHOLD && prefixKnown) {
      for (const e of allEntries) {
        if (e.freqBand === band) known.add(e.id);
      }
    }
    prefixKnown = prefixKnown && rate >= BAND_KNOWN_THRESHOLD;
  }

  // Highest level whose entry threshold the learner clears.
  let levelId = levels[0].id;
  for (const level of levels) {
    if (estimatedVocab >= level.entryKnownWords) levelId = level.id;
  }

  return { estimatedVocab, levelId, knownLexemeIds: [...known] };
}
