/**
 * The Grammar Hub: a reference book of short grammar pages.
 *
 * Kept out of `load.ts` on purpose. That module parses the whole lexicon when
 * it is imported; the hub only needs its own file, and its pages should not pay
 * for a 1.8 MB parse they never read.
 */
import hubJson from "@content/grammar-hub/entries.json";
import { GRAMMAR_LEVEL_ORDER } from "./cefr";
import { grammarHubFileSchema, type GrammarLevel, type HubEntry } from "./schema";

/**
 * Every page in reading order: level first, then usefulness within the level.
 * This order *is* the design - easy and useful at the top of the book, harder
 * further down - so every list of pages should start from this array.
 */
export const hubEntries: HubEntry[] = grammarHubFileSchema
  .parse(hubJson)
  .entries.slice()
  .sort(
    (a, b) =>
      GRAMMAR_LEVEL_ORDER.indexOf(a.level) - GRAMMAR_LEVEL_ORDER.indexOf(b.level) ||
      a.rank - b.rank,
  );

const bySlug = new Map(hubEntries.map((e) => [e.slug, e]));

export function hubEntryBySlug(slug: string): HubEntry | undefined {
  return bySlug.get(slug);
}

/** The levels that have at least one page, in CEFR order. */
export const hubLevels: GrammarLevel[] = GRAMMAR_LEVEL_ORDER.filter((level) =>
  hubEntries.some((e) => e.level === level),
);

export function hubEntriesForLevel(level: GrammarLevel): HubEntry[] {
  return hubEntries.filter((e) => e.level === level);
}

/** Hub pages that explain the grammar a course lesson practises. */
export function hubEntriesForLesson(lessonId: string): HubEntry[] {
  return hubEntries.filter((e) => e.lessonIds.includes(lessonId));
}

/** Chapter names for the book. The course map uses its own titles. */
export const HUB_CHAPTER_TITLE: Record<GrammarLevel, string> = {
  A1: "First steps",
  A2: "Everyday life",
  B1: "Saying more",
  B2: "Fine shades",
  C1: "Refinement",
  C2: "Mastery",
};

/**
 * The "Most looked up" shelf at the top of the hub.
 *
 * Chosen by hand, not computed: these are the rules a beginner trips over in
 * their first texts. A slug that has no page yet is skipped, so the shelf can
 * name pages before they are written.
 */
const MOST_LOOKED_UP = ["ezafe", "present-tense", "object-marker-ra", "plurals", "possessive-endings"];

export const hubMostLookedUp: HubEntry[] = MOST_LOOKED_UP.flatMap((slug) => {
  const e = bySlug.get(slug);
  return e ? [e] : [];
});
