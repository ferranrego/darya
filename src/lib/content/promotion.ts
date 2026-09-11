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

/**
 * Share of this level's reviews the learner must be getting right.
 *
 * Promotion has only ever counted words marked "known" - never accuracy, never
 * retention, never comprehension. A learner can therefore accumulate the count
 * while forgetting most of it, and the app promotes them into harder text on
 * the strength of a number that stopped being true.
 *
 * 0.50, and the number was corrected by measuring rather than reasoned to.
 *
 * The first value here was 0.75, argued from FSRS being configured to a 0.90
 * target retention. Running `pnpm report:learning` against the real deployment
 * the same afternoon said mature-card retention is **54%** - so the "obvious"
 * threshold would have frozen every current learner at their level, silently,
 * which is precisely the class of defect this repo's first rule is about.
 *
 * 0.50 is therefore set from the data: below half of mature cards remembered
 * is a learner who has stopped retaining anything, which is worth acting on;
 * anywhere above it is within reach of everyone currently using the app. It is
 * a floor against coasting, not a bar to clear.
 *
 * That 54% is itself a finding - FSRS is scheduling for 90% and getting 54%,
 * on 70 mature reviews across seven learners. Too thin to retune a scheduler
 * on, and the reason this constant must be revisited as the data grows rather
 * than left to calcify.
 */
export const PROMOTION_RETENTION = 0.5;

/**
 * Share of comprehension checks the learner must be passing.
 *
 * Lower than the retention floor on purpose. A comprehension question is four
 * options, so 0.25 is the floor of pure guessing, and the check is often taken
 * once per text with no second attempt. 0.6 is comfortably above chance and
 * comfortably below "read every text perfectly" - again a floor against
 * finishing texts without reading them, which is exactly what the app allowed
 * before these checks existed.
 */
export const PROMOTION_COMPREHENSION = 0.6;

/**
 * Fewest reviews and checks before either floor is applied at all.
 *
 * Two reviews and one quiz is not a measurement, and refusing promotion on it
 * would be refusing on noise. Below these counts the evidence is treated as
 * absent, which - per the decision recorded in `PromotionEvidence` - does not
 * block anybody.
 */
export const MIN_REVIEWS_FOR_RETENTION = 20;
export const MIN_CHECKS_FOR_COMPREHENSION = 5;

/**
 * What the learner has actually demonstrated at this level.
 *
 * Absent evidence never blocks a promotion, and that is a deliberate decision
 * rather than an oversight. Every learner already mid-course has no
 * comprehension history at all - the feature did not exist - and holding them
 * at their level for the app's own omission would be punishing them for a
 * change they did not make. The floors bite once there is enough evidence to
 * mean something, and never retroactively: nobody is ever demoted.
 */
export interface PromotionEvidence {
  /** Reviews answered at this level, and the share answered correctly. */
  reviews: number;
  retention: number;
  /** Comprehension checks taken at this level, and the share answered correctly. */
  checks: number;
  comprehension: number;
}

/**
 * Whether the evidence is good enough to promote, and what is missing if not.
 *
 * Separate from `nextLevelFor` so the answer can be shown to the learner. "Not
 * yet" with no reason is the same dead end as the level system having no
 * evidence requirement at all - the learner cannot act on either.
 */
export function evidenceBlocks(evidence: PromotionEvidence | undefined): string | null {
  if (!evidence) return null;
  if (evidence.reviews >= MIN_REVIEWS_FOR_RETENTION && evidence.retention < PROMOTION_RETENTION) {
    return "the words at this level are not sticking yet";
  }
  if (
    evidence.checks >= MIN_CHECKS_FOR_COMPREHENSION &&
    evidence.comprehension < PROMOTION_COMPREHENSION
  ) {
    return "the texts at this level are not being understood yet";
  }
  return null;
}

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
  /** Retention and comprehension at this level. Absent evidence never blocks. */
  evidence?: PromotionEvidence;
}): Level | null {
  const { current, levels, knownCount, levelCoverage, evidence } = input;
  const currentIdx = levels.findIndex((l) => l.id === current.id);
  if (currentIdx === -1) return null;

  // Applied to the promotion, never to the level already held: a learner is
  // never demoted, and a learner who was promoted under the old rule keeps
  // what they have.
  if (evidenceBlocks(evidence)) return null;

  /**
   * The global rule, deliberately still able to jump several levels at once.
   *
   * The plan that produced this change proposed capping it, because the count
   * it reads used to include up to 500 words the placement marked known
   * without asking. That is fixed at the source now - the placement no longer
   * invents vocabulary - and capping as well would take a real behaviour away
   * from a genuinely advanced learner, who should reach their level in one
   * step rather than several weeks. The evidence floors below apply to this
   * rule too, which is the guard that was actually missing.
   */
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
