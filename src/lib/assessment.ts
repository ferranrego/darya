import { FREQ_BAND_COUNT, type LexiconEntry } from "./content/schema";
import { levels } from "./content/load";

/**
 * Level assessment: sample words across frequency bands, estimate vocabulary
 * size from per-band recognition rates, pick a starting level, and decide
 * which words to seed as known.
 */

/**
 * How many words to seed initially for the dynamic spawner.
 */
const INITIAL_SEED_BANDS = [
  1, 1, 1, 1, 1, 1,
  2, 2, 2, 2,
  3, 3, 3, 3,
  4, 4, 4,
  5, 5, 5,
  6, 6, 6,
  7, 7, 7,
  8, 8, 8,
  9, 9,
  10, 10,
  11, 11,
  12
];

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
