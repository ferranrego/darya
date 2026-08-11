/**
 * Detects a lexicon whose `freqRank` is secretly insertion order.
 *
 * `freqRank` is supposed to come from `build-frequency.ts`, but an entry
 * appended by hand after the last time that script ran gets whatever
 * `freqRank` the authoring tool assigned it - typically "one past the current
 * maximum" - which makes rank a function of when the word was typed, not of
 * how common it is. That is the exact defect `build-frequency.ts`'s own header
 * describes ("ranks were the order words happened to be typed into a file"),
 * recurring in every entry added since.
 *
 * Measured on Dari: a contiguous block of 121 entries at the tail of the file
 * (`lx-6037`..`lx-6157`) all sit in `freqBand` 10 with `freqRank` exactly
 * `id - 3` - a fixed offset from their own id, for every single one of them.
 * The affected words include `کچالو` (potato), `نمک` (salt), `میز` (table),
 * `آشپزخانه` (kitchen): beginner-core, everyday, and ranked as the rarest
 * words in a 6,154-entry lexicon for no reason but arrival order. Every
 * ordering the reader uses - `selectTargets`, `selectKnown`, `coldStartKnown` -
 * sorts by `freqRank`, so these words could never reach a beginner text.
 *
 * Detected generically, not by the id range above, so the same check catches
 * the next batch that ships the same way, in either language: a lexicon's ids
 * are assigned sequentially at authoring time, so "rank tracks id with a fixed
 * offset" is what "nobody has ranked this yet" looks like, however far back it
 * started.
 */

import type { LexiconEntry } from "../src/lib/content/schema.ts";

function idNumber(id: string): number {
  return Number(id.replace(/^lx-/, ""));
}

/**
 * A single coincidental id/rank match is not evidence - the very first entries
 * in a lexicon are often ranked in roughly the order they were typed too,
 * because that is genuinely close to frequency order at the head. Only a long
 * run is evidence of an unranked batch.
 */
const MIN_RUN = 20;

/**
 * The maximal contiguous (by id) suffix of entries whose `freqRank` is a fixed
 * offset from their own id - i.e. never independently ranked. Empty if the
 * lexicon shows no such run.
 */
export function insertionOrderSuffix(entries: readonly LexiconEntry[]): LexiconEntry[] {
  const byId = [...entries].sort((a, b) => idNumber(a.id) - idNumber(b.id));
  if (byId.length === 0) return [];

  let i = byId.length - 1;
  const offset = byId[i].freqRank - idNumber(byId[i].id);
  while (i > 0 && byId[i - 1].freqRank - idNumber(byId[i - 1].id) === offset) i--;

  const run = byId.slice(i);
  return run.length >= MIN_RUN ? run : [];
}

/**
 * A row from `scripts/data/freq-<lang>.tsv` - `build-frequency.ts`'s audit
 * artifact, committed alongside the lexicon it was derived from.
 */
export interface FreqTsvRow {
  lexemeId: string;
  rank: number;
}

/**
 * Lexemes where the TSV's rank and the shipped lexicon's `freqRank` disagree
 * by more than `tolerance`.
 *
 * The two are only guaranteed to agree immediately after a `build-frequency.ts
 * --apply` run - both are written from the same `scored` array in that one
 * pass. A dry run (or any later hand-edit of `freqRank`, e.g.
 * `rederive-levels.ts`) can commit a TSV that no longer matches, silently: the
 * TSV looks like a ranking but is actually the record of a proposal nobody
 * applied. `tolerance` absorbs the ordinary noise of a corpus refresh (ties
 * reordering by a handful of ranks); anything past it is evidence the two
 * files describe different rankings, not the same one measured twice.
 */
export function tsvRankDrift(
  entries: readonly LexiconEntry[],
  tsvRows: readonly FreqTsvRow[],
  tolerance: number,
): { lexemeId: string; lexiconRank: number; tsvRank: number }[] {
  const lexiconRankById = new Map(entries.map((e) => [e.id, e.freqRank]));
  const out: { lexemeId: string; lexiconRank: number; tsvRank: number }[] = [];
  for (const row of tsvRows) {
    const lexiconRank = lexiconRankById.get(row.lexemeId);
    if (lexiconRank === undefined) continue; // TSV row for an id no longer in the lexicon.
    if (Math.abs(lexiconRank - row.rank) > tolerance) {
      out.push({ lexemeId: row.lexemeId, lexiconRank, tsvRank: row.rank });
    }
  }
  return out;
}

/** Parses `build-frequency.ts`'s TSV format: header row, then `rank \t band \t lexemeId \t ...`. */
export function parseFreqTsv(raw: string): FreqTsvRow[] {
  const lines = raw.trim().split("\n");
  const header = lines[0].split("\t");
  const rankCol = header.indexOf("rank");
  const idCol = header.indexOf("lexemeId");
  return lines.slice(1).map((line) => {
    const cols = line.split("\t");
    return { lexemeId: cols[idCol], rank: Number(cols[rankCol]) };
  });
}
