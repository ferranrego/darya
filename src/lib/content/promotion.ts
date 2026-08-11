import { isBeginnerLevel } from "./word-selection.ts";
import type { Level } from "./schema.ts";

/**
 * How much of a beginner level's own content vocabulary a learner must have
 * worked through before the curriculum-coverage promotion rule applies.
 *
 * Not a research figure - PEDAGOGY.md's own rule is that any threshold here
 * must say why it was picked. 0.70 is a product choice: high enough to mean
 * real engagement with the level, not a token fraction of it, chosen to land
 * roughly six weeks of daily reading at L1's authored pace. Revisit once
 * there is real completion-time data.
 */
export const PROMOTION_COVERAGE = 0.7;

export interface LevelCoverage {
  /** Content-word lexemes in this level's vocabulary the learner has worked - known, or learning with at least one completed review. */
  met: number;
  /** Content-word lexemes in this level's own vocabulary, total. */
  total: number;
  /** Every authored seed text at this level has been read. */
  allSeedTextsRead: boolean;
}

/**
 * The next level a learner should be promoted to, or null to stay put.
 *
 * Two independent rules, and the higher result wins:
 *
 * - The existing global rule: the highest level whose `entryKnownWords` the
 *   learner's total known-word count already clears. Untouched by this
 *   function's existence - a learner placed or promoted this way before is
 *   unaffected, and it can still jump more than one level at once.
 * - A curriculum-coverage rule, beginner levels only, promoting exactly one
 *   level up: has this learner worked through *this* level's own vocabulary
 *   and finished its authored texts. This exists because the global rule is
 *   arithmetically unreachable from L1 alone (481/429 words against L2's
 *   500-word gate) - the question here is "have you done the level", not
 *   "do you know 500 words". Counting `learning` rows (via `LevelCoverage.met`)
 *   is deliberately only acceptable in this one place, guarded by requiring
 *   at least one real review (the caller's job to compute) so a tapped-once-
 *   and-forgotten word does not count as "worked".
 */
export function nextLevelFor(input: {
  current: Level;
  levels: readonly Level[];
  knownCount: number;
  levelCoverage?: LevelCoverage;
}): Level | null {
  const { current, levels, knownCount, levelCoverage } = input;
  const currentIdx = levels.findIndex((l) => l.id === current.id);
  if (currentIdx === -1) return null;

  const globalEligible = [...levels].reverse().find((l) => knownCount >= l.entryKnownWords) ?? null;
  const globalIdx = globalEligible ? levels.findIndex((l) => l.id === globalEligible.id) : -1;

  let coverageIdx = -1;
  if (isBeginnerLevel(current) && levelCoverage && levelCoverage.total > 0) {
    const ratio = levelCoverage.met / levelCoverage.total;
    if (ratio >= PROMOTION_COVERAGE && levelCoverage.allSeedTextsRead) {
      coverageIdx = currentIdx + 1 < levels.length ? currentIdx + 1 : -1;
    }
  }

  const bestIdx = Math.max(globalIdx, coverageIdx);
  return bestIdx > currentIdx ? levels[bestIdx] : null;
}
