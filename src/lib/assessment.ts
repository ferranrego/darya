import { FREQ_BAND_COUNT, type LexiconEntry } from "./content/schema";
import { levels } from "./content/load";

/**
 * Level assessment: sample words across frequency bands, estimate vocabulary
 * size from per-band recognition rates, pick a starting level, and decide
 * which words to seed as known.
 */

/** Approximate real-world width (word count) of each frequency band. */
const BAND_WIDTHS = [100, 150, 250, 300, 400, 500, 700, 1000];

const SAMPLE_PER_BAND = [10, 9, 9, 8, 8, 6, 0, 0];

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

  let estimatedVocab = 0;
  const known = new Set<string>(selectedIds);
  for (let band = 1; band <= FREQ_BAND_COUNT; band++) {
    const s = perBand.get(band);
    if (!s || s.total === 0) continue;
    const rate = s.hit / s.total;
    estimatedVocab += Math.round(rate * BAND_WIDTHS[band - 1]);
    if (rate >= BAND_KNOWN_THRESHOLD) {
      for (const e of allEntries) {
        if (e.freqBand === band) known.add(e.id);
      }
    }
  }

  // Highest level whose entry threshold the learner clears.
  let levelId = levels[0].id;
  for (const level of levels) {
    if (estimatedVocab >= level.entryKnownWords) levelId = level.id;
  }

  return { estimatedVocab, levelId, knownLexemeIds: [...known] };
}
