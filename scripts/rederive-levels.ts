/**
 * Derive each level's `freqBands` from its CEFR vocabulary target.
 *
 * `entryKnownWords` is a claim about the learner - "you know this many words,
 * so you are at this level" - and it is shown to them as their target on the
 * Words screen. It therefore has to come from what the CEFR levels actually
 * mean, not from anything about this repository.
 *
 * An earlier version of this script had it backwards. It computed
 *
 *     entryKnownWords(Lk) = highest freqRank in the top band of L(k-1)
 *
 * which is self-consistent and completely circular: band edges are an arbitrary
 * geometric schedule over the lexicon (see BAND_FRACTIONS in
 * build-frequency.ts), so that made "A1" mean "the first 2% of whatever words
 * we happen to have". Dari A1 came out at 121 words against a real figure
 * nearer 500, and the app told learners they were most of the way to A1 when
 * they were not.
 *
 * So the direction is: CEFR target in, bands out. `freqBands` is the derived
 * quantity, chosen to cover everything up to the *next* level's target, so each
 * level can teach exactly the vocabulary that gets the learner to the next one.
 *
 * Usage: node scripts/rederive-levels.ts --lang ca [--apply]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { LexiconEntry, Level } from "../src/lib/content/schema.ts";
import { contentRoot, targetLang } from "./content-path.ts";

/**
 * Receptive vocabulary, in lemmas, at which a learner is at each CEFR level.
 *
 * These are the published figures (Milton, *Measuring Second Language
 * Vocabulary Acquisition*; Nation's word-family counts), not numbers tuned to
 * this lexicon. They are what makes "you know 480 of 500 words towards A1" a
 * true statement rather than a rescaling of the file size.
 *
 * C2 is nominally ~8,000 lemmas, which neither lexicon reaches (ca has 4,343,
 * prs 6,033). Rather than pretend, `cap` below clamps the top levels to what
 * the content can actually support and the run prints when it has done so -
 * the honest reading being that the upper levels are vocabulary-limited by the
 * lexicon, which is a content gap to close, not a threshold to fudge.
 */
const CEFR_VOCABULARY: Record<string, number> = {
  "pre-A1": 0,
  A1: 500,
  A2: 1200,
  "A2+": 1700,
  B1: 2500,
  B2: 4000,
  C1: 6000,
  C2: 8000,
};

/**
 * Fit the CEFR targets to a lexicon that may be too small for them.
 *
 * A threshold at the very end of the lexicon leaves its level nothing to teach,
 * so nothing may exceed `ceiling` (the full lexicon). Catalan has 4,609 lemmas
 * against a C2 figure of 8,000, so its top levels genuinely do not have the
 * vocabulary behind them - clamping each one independently would pile B2, C1
 * and C2 onto the same number and make three levels indistinguishable.
 *
 * Instead the targets stay true while they fit, and the levels that do not fit
 * are spread evenly across what remains. Those levels are then vocabulary-
 * limited by the content rather than by the learner, which the caller reports:
 * the fix is a bigger lexicon, not a smaller number.
 *
 * Dividing by `remaining + 1` rather than `remaining` is the fix for a defect
 * this function used to have. Linear interpolation from `floor` to `ceiling`
 * over `remaining` steps necessarily lands the *last* one exactly on
 * `ceiling` - by construction, `floor + step * remaining == ceiling`. For
 * every level except the last that is fine; for the last it means the top
 * level's own `entryKnownWords` lands exactly at the top of everything the
 * lexicon has, leaving it nothing left to teach - the generator finds no
 * target words there either, the same dead end this whole script exists to
 * catch. Measured before this fix: Catalan's B2 (2500→4000, uncompressed)
 * sat one band-width from a C1 compressed to 4028 and a C2 compressed to
 * 4055 - three levels sharing a ~55-word margin at the very point the
 * generator most needs room to pick target words from. Reserving one extra
 * step's worth of headroom below `ceiling` fixes the top level the same way
 * it fixes every other compressed one.
 */
function fitTargets(raw: number[], ceiling: number): { targets: number[]; compressed: number } {
  const firstOver = raw.findIndex((t) => t > ceiling);
  if (firstOver === -1) return { targets: raw, compressed: 0 };

  const targets = raw.slice(0, firstOver);
  const floor = targets.at(-1) ?? 0;
  const remaining = raw.length - firstOver;
  const step = (ceiling - floor) / (remaining + 1);
  for (let i = 0; i < remaining; i++) targets.push(Math.round(floor + step * (i + 1)));
  return { targets, compressed: remaining };
}

/** Typical words per sentence, read off each level's own sentenceLengthHint. */
function avgSentenceWords(level: Level): number {
  const max = level.sentenceLengthHint.match(/max (\d+) words/);
  // Real sentences cluster well below the cap; three-quarters of it tracks the
  // seed texts closely and never over-estimates a text's length.
  return max ? Math.round(Number(max[1]) * 0.75) : 7;
}

function main() {
  const lang = targetLang();
  const apply = process.argv.includes("--apply");
  const root = contentRoot();

  const lexicon = JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8"));
  const entries: LexiconEntry[] = lexicon.entries;

  /** Highest freqRank present in each band. */
  const bandTop = new Map<number, number>();
  for (const e of entries) {
    bandTop.set(e.freqBand, Math.max(bandTop.get(e.freqBand) ?? 0, e.freqRank));
  }

  const levelsPath = join(root, "levels", "levels.json");
  const file = JSON.parse(readFileSync(levelsPath, "utf8"));
  const levels: Level[] = file.levels;

  const bands = [...bandTop.keys()].sort((a, b) => a - b);
  const lexiconSize = entries.length;

  /** Every band needed to reach `rank`, i.e. up to and including the one holding it. */
  function bandsCovering(rank: number): number[] {
    const out: number[] = [];
    for (const b of bands) {
      out.push(b);
      if ((bandTop.get(b) ?? 0) >= rank) break;
    }
    return out;
  }

  const rows: string[] = [];
  const problems: string[] = [];
  const capped: string[] = [];

  const rawTargets = levels.map((level) => {
    const raw = CEFR_VOCABULARY[level.cefrHint];
    if (raw === undefined) {
      problems.push(`${level.id}: cefrHint "${level.cefrHint}" has no vocabulary target`);
      return 0;
    }
    return raw;
  });

  // The whole lexicon. Reserving less than this - the previous version used
  // the *second-to-last* band's top, on paper "so the top level always has a
  // band left to teach" - is now redundant with `fitTargets`'s own
  // `remaining + 1` reservation, and it was redundant in the wrong direction:
  // Catalan's second-to-last band tops out at 4055, a hair above B2's
  // uncompressed 4000, so C1 and C2 were being interpolated into a ~55-word
  // gap regardless of how that gap was divided. The ceiling needs to be
  // generous; the *reservation* is what `fitTargets` now does.
  const ceiling = bandTop.get(bands.at(-1)!) ?? lexiconSize;
  const { targets, compressed } = fitTargets(rawTargets, ceiling);
  for (let i = 0; i < targets.length; i++) {
    if (targets[i] !== rawTargets[i]) {
      capped.push(`${levels[i].cefrHint} ${rawTargets[i]}→${targets[i]}`);
    }
  }

  const updated = levels.map((level, i) => {
    const entryKnownWords = targets[i];
    // A level teaches whatever gets the learner to the next level's target; the
    // top level draws from everything that is left.
    const reachFor = i + 1 < targets.length ? targets[i + 1] : lexiconSize;
    const freqBands = bandsCovering(reachFor);
    const teachesTo = bandTop.get(Math.max(...freqBands)) ?? 0;
    const avg = avgSentenceWords(level);

    // A level that can introduce nothing is a dead end: the generator finds no
    // target words and the reader stalls on "Writing your next text…". Catching
    // it here is the difference between a loud failure and one learner quietly
    // stuck forever.
    if (teachesTo <= entryKnownWords) {
      problems.push(
        `${level.id} teaches up to rank ${teachesTo} but learners arrive knowing ${entryKnownWords} - ` +
          `it can introduce nothing.`,
      );
    }
    rows.push(
      `${level.id} ${level.cefrHint.padEnd(6)}` +
        `  entryKnownWords ${String(level.entryKnownWords).padStart(5)} → ${String(entryKnownWords).padStart(5)}` +
        `  bands ${Math.min(...freqBands)}-${Math.max(...freqBands)} (teaches to ${String(teachesTo).padStart(5)})` +
        `  avgSentenceWords ${avg}`,
    );
    return { ...level, freqBands, entryKnownWords, avgSentenceWords: avg };
  });

  if (compressed > 0) {
    console.log(
      `${lang}: the lexicon holds ${lexiconSize} lemmas, which is short of the published ` +
        `CEFR figures for its top ${compressed} level(s). Those are spread across the ` +
        `vocabulary that exists and are content-limited, not learner-limited: ${capped.join(", ")}.\n` +
        `      Growing the lexicon is what raises them.`,
    );
  }

  console.log(`${lang}:`);
  console.log(rows.join("\n"));

  if (problems.length > 0) {
    console.error(`\n${problems.length} problem(s):\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }

  if (!apply) {
    console.log("\n(dry run - pass --apply to rewrite levels.json)");
    return;
  }
  file.levels = updated;
  writeFileSync(levelsPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nrewrote ${levelsPath}`);
}

main();
