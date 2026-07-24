import { FREQ_BAND_COUNT, type LexiconEntry } from "./content/schema";
import { levels } from "./content/load";

/**
 * Level assessment: sample words across frequency bands, estimate vocabulary
 * size from per-band recognition rates, pick a starting level, and decide
 * which words to seed as known.
 */

/**
 * How many words to show from each frequency band (50 total). Every band is
 * sampled — including 7 and 8 — so the estimate can span the whole lexicon;
 * otherwise the upper levels are mathematically unreachable.
 */
const SAMPLE_PER_BAND = [8, 7, 7, 6, 6, 6, 5, 5];

/** Bands with recognition at or above this seed every core word as known. */
const BAND_KNOWN_THRESHOLD = 0.8;

export interface AssessmentWord {
  entry: LexiconEntry;
  band: number;
}

export function sampleAssessmentWords(entries: LexiconEntry[]): AssessmentWord[] {
  const byBand = new Map<number, LexiconEntry[]>();
  for (const e of entries) {
    // Function words make poor assessment items; prefer content words.
    if (e.pos === "particle" || e.pos === "conjunction" || e.pos === "preposition") continue;
    const list = byBand.get(e.freqBand) ?? [];
    list.push(e);
    byBand.set(e.freqBand, list);
  }

  const out: AssessmentWord[] = [];
  for (let band = 1; band <= FREQ_BAND_COUNT; band++) {
    const pool = [...(byBand.get(band) ?? [])];
    const want = SAMPLE_PER_BAND[band - 1] ?? 0;
    // Deterministic-ish spread: sort by rank, take evenly spaced items.
    pool.sort((a, b) => a.freqRank - b.freqRank);
    const step = Math.max(1, Math.floor(pool.length / Math.max(want, 1)));
    for (let i = 0; i < pool.length && out.filter((w) => w.band === band).length < want; i += step) {
      out.push({ entry: pool[i], band });
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
