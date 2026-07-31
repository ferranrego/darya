import type { GrammarLevel, Level } from "./schema.ts";

/**
 * The one place a reading level is turned into a CEFR grammar level.
 *
 * There used to be two hardcoded tables and neither read `cefrHint`, so they
 * could not agree and neither matched the content:
 *
 *   - `grammarStartLevel` mapped L3→A2, L4→B1, L5→B2, L6→C1. That is the *Dari*
 *     level ladder. Catalan has an extra A2+ step, so its L5 is B1 and its L6 is
 *     B2 — a Catalan learner assessed at B2 was started on the C1 course and
 *     skipped the entire B2 grammar course.
 *   - `journey-map.tsx` mapped L1→A1, L2→A2, L3→B1 … off by one for *both*
 *     languages from L2 up, and it enumerated only L1..L6, so Catalan's L7 and
 *     L8 rendered no node at all.
 *
 * `levels.json` already carries the answer in `cefrHint`. Deriving from it means
 * adding a level to a language cannot silently mis-map anything, and the two
 * languages stop needing to share a ladder shape they do not have.
 */

/** Canonical CEFR order, used for indexing even before every level ships. */
export const GRAMMAR_LEVEL_ORDER: GrammarLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

/**
 * The grammar course a level studies.
 *
 * `cefrHint` is a description of the *reading* level and is finer-grained than
 * the grammar courses: Catalan distinguishes a pre-A1 warm-up and an A2+ step
 * that consolidates A2 rather than introducing B1 grammar. Both collapse onto
 * the nearest course that exists, so two levels can legitimately share one —
 * callers that build a course list must de-duplicate.
 */
export function cefrOf(level: Level): GrammarLevel {
  const hint = level.cefrHint.trim();
  if (hint.startsWith("pre-")) return "A1";
  const base = hint.replace(/\+$/, "");
  const found = GRAMMAR_LEVEL_ORDER.find((l) => l === base);
  if (!found) {
    throw new Error(
      `Level ${level.id} has cefrHint "${level.cefrHint}", which is not a CEFR level. ` +
        `Expected one of ${GRAMMAR_LEVEL_ORDER.join(", ")}, optionally prefixed "pre-" or suffixed "+".`,
    );
  }
  return found;
}

export interface JourneyNode {
  levelId: string;
  /** Shown on the node, e.g. "A2+". The reading level's own label. */
  cefrHint: string;
  name: string;
  /** The grammar course this level studies. */
  grammar: GrammarLevel;
  /**
   * Whether this level is the first to study `grammar`. Two levels can share a
   * course (Catalan L3 "A2" and L4 "A2+"), and rendering the same course twice
   * reads as duplicated work.
   */
  ownsGrammar: boolean;
  entryKnownWords: number;
}

/**
 * The learner's path, derived from the levels the language actually ships.
 *
 * Pure and language-agnostic so both ladders can be asserted in a test; the
 * component only renders what this returns.
 */
export function buildJourneyNodes(levels: readonly Level[]): JourneyNode[] {
  const seen = new Set<GrammarLevel>();
  return levels.map((level) => {
    const grammar = cefrOf(level);
    const ownsGrammar = !seen.has(grammar);
    seen.add(grammar);
    return {
      levelId: level.id,
      cefrHint: level.cefrHint,
      name: level.name,
      grammar,
      ownsGrammar,
      entryKnownWords: level.entryKnownWords,
    };
  });
}
