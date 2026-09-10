/**
 * Seed texts still missing their pronunciation line, exempted from the
 * requirement in `build-seed-texts.ts` until they are written.
 *
 * **This list may only shrink.** `translit-backlog.test.ts` asserts its size
 * never grows, and the exemption disappears with the list.
 *
 * Why it exists: 273 of the 400 beginner sentences carry no transliteration.
 * The app has no audio, so that Latin line is the *entire* pronunciation of
 * the language - a learner who answered "no, I can't read the script" at
 * sign-up gets nothing at all under two thirds of the first sentences they
 * ever read, and the reader renders the gap as silence rather than an error.
 *
 * The field was made optional so a Latin-script language could share the
 * format, and nothing put the requirement back for a language that declares
 * `capabilities.transliteration`. Measured while writing this file, the gap
 * was *growing*: it was 231 of 358 a few commits ago, and every batch of
 * authoring since has added sentences without pronunciation, because nothing
 * was watching. Hence the gate now, and the backlog to carry what predates it
 * - a permanently-optional field would let the same drift restart tomorrow.
 *
 * Clearing one: write the lines into `seed-texts-prs.ts`, run
 * `scripts/review-batch.ts`, get a philologist pass (the majhul vowels are
 * the thing to check - dōst not dust, shēr not shir), then delete the slug
 * here in the same commit.
 */
export const TRANSLIT_BACKLOG: ReadonlySet<string> = new Set([
  "l1-009",
  "l1-010",
  "l1-011",
  "l1-012",
  "l1-013",
  "l1-014",
  "l1-015",
  "l1-016",
  "l1-017",
  "l1-018",
  "l1-019",
  "l1-020",
  "l1-021",
  "l1-022",
  "l1-023",
  "l1-024",
  "l1-025",
  "l1-026",
  "l1-027",
  "l1-028",
  "l1-029",
  "l1-030",
  "l1-031",
  "l1-032",
  "l1-033",
  "l1-034",
  "l1-035",
  "l1-036",
  "l1-037",
  "l2-009",
  "l2-010",
  "l2-011",
  "l2-012",
  "l2-013",
  "l2-014",
  "l2-015",
  "l2-016",
  "l2-017",
  "l2-018",
  "l2-019",
  "l2-020",
  "l2-021",
  "l2-022",
  "l2-023",
  "l2-024",
  "l2-025",
  "l2-026",
  "l2-027",
  "l2-028",
  "l2-029",
  "l2-030",
  "l2-031",
  "l2-032",
  "l2-033",
  "l2-034",
  "l2-035",
  "l2-036",
  "l2-037",
  "l2-038",
  "l2-039",
  "l2-040",
  "l2-041",
  "l2-042",
  "l2-043",
  "l2-044",
]);
