/**
 * Typed, build-time loaders for the open content files. Content ships in the
 * app bundle, so no network round-trip for lexicon/course/levels.
 */
import alphabetJson from "@content/alphabet/course.json";
import grammarJson from "@content/grammar/all.json";
import lexiconJson from "@content/lexicon/lexicon.json";
import themesJson from "@content/lexicon/themes.json";
import beginnerSpecJson from "@content/lexicon/beginner-spec.json";
import levelsJson from "@content/levels/levels.json";
import { buildIndex, type LexiconIndex } from "../text";
import { GRAMMAR_LEVEL_ORDER, cefrOf } from "./cefr";
import {
  alphabetCourseSchema,
  beginnerSpecSchema,
  grammarCoursesFileSchema,
  levelsFileSchema,
  lexiconFileSchema,
  type AlphabetCourse,
  type BeginnerSpec,
  type GrammarCourse,
  type GrammarLesson,
  type GrammarLevel,
  type Level,
  type LexiconEntry,
  type LexiconFile,
  type LevelsFile,
  themesFileSchema,
  type Theme,
} from "./schema";

export const lexicon: LexiconFile = lexiconFileSchema.parse(lexiconJson);
export const themes: Theme[] = themesFileSchema.parse(themesJson);
export const beginnerSpec: BeginnerSpec = beginnerSpecSchema.parse(beginnerSpecJson);
export const alphabetCourse: AlphabetCourse = alphabetCourseSchema.parse(alphabetJson);
export const levelsFile: LevelsFile = levelsFileSchema.parse(levelsJson);

export { GRAMMAR_LEVEL_ORDER, cefrOf, buildJourneyNodes, type JourneyNode } from "./cefr";

/**
 * Every grammar course this language ships, ordered by CEFR level.
 *
 * One barrel file rather than a static import per level: languages start at
 * different points. Dari ships all six; Catalan starts with A1. A hardcoded
 * a1..c2 import list would fail the build on the missing files instead of
 * simply offering fewer levels.
 */
export const grammarCourses: GrammarCourse[] = grammarCoursesFileSchema
  .parse(grammarJson)
  .courses.sort(
    (a, b) => GRAMMAR_LEVEL_ORDER.indexOf(a.level) - GRAMMAR_LEVEL_ORDER.indexOf(b.level),
  );

/** All grammar lessons in course order, flattened across every level and block. */
export const grammarLessons: GrammarLesson[] = grammarCourses.flatMap((c) =>
  c.blocks.flatMap((b) => b.lessons),
);

const lessonLevelById = new Map<string, GrammarLevel>();
for (const course of grammarCourses) {
  for (const block of course.blocks) {
    for (const lesson of block.lessons) lessonLevelById.set(lesson.id, course.level);
  }
}

export function grammarLessonById(id: string): GrammarLesson | undefined {
  return grammarLessons.find((l) => l.id === id);
}

export function grammarLessonLevel(id: string): GrammarLevel | undefined {
  return lessonLevelById.get(id);
}

/**
 * The grammar level a learner starts at, from their assessed level_estimate.
 * Levels below this are treated as already completed and hidden, so a learner
 * who tested into A2 begins at A2 with A1 marked done. Clamped to the highest
 * level that actually has content, so a learner never lands on an empty screen.
 *
 * The mapping comes from the level's own `cefrHint` via `cefrOf`. It used to be
 * a hardcoded switch shaped like the Dari ladder, which meant a Catalan learner
 * assessed at L6 — which is B2 in Catalan, not C1 — was started on C1 and never
 * saw the B2 course at all.
 */
export function grammarStartLevel(levelEstimate: string | null | undefined): GrammarLevel {
  const level = levels.find((l) => l.id === levelEstimate);
  const desired: GrammarLevel = level ? cefrOf(level) : "A1";
  const available = grammarCourses.map((c) => c.level);
  const maxAvailableIdx = Math.max(...available.map((l) => GRAMMAR_LEVEL_ORDER.indexOf(l)));
  const desiredIdx = GRAMMAR_LEVEL_ORDER.indexOf(desired);
  return GRAMMAR_LEVEL_ORDER[Math.min(desiredIdx, maxAvailableIdx)];
}

export const levels: Level[] = levelsFile.levels;

/**
 * The levels a learner can actually reach.
 *
 * `levels` is every level the content defines; this is the ladder the product
 * offers. Catalan ships C1 and C2 content that is not finished - 65 entries in
 * their vocabulary still have no gloss - so they are marked unavailable rather
 * than deleted. Everything that decides where a learner can go reads this:
 * the journey map, the level-up check and the placement.
 */
export const availableLevels: Level[] = levels.filter((l) => l.available);

let index: LexiconIndex | null = null;
export function lexiconIndex(): LexiconIndex {
  index ??= buildIndex(lexicon.entries);
  return index;
}

export function lexemeById(id: string): LexiconEntry | undefined {
  return lexiconIndex().byId.get(id);
}

export function levelById(id: string): Level {
  const level = levels.find((l) => l.id === id);
  if (!level) throw new Error(`Unknown level ${id}`);
  return level;
}

/**
 * Human-readable label for a level estimate, e.g. "A1 · Daily life".
 * Falls back to the first level for null/unknown ids.
 */
export function levelLabel(levelId: string | null | undefined): string {
  const level = levels.find((l) => l.id === levelId) ?? levels[0];
  return `${level.cefrHint.replace(/^pre/, "Pre")} · ${level.name}`;
}

export function getWordsByThemeOnly(theme: string): LexiconEntry[] {
  return lexicon.entries.filter((word) => {
    return word.tags?.includes(theme);
  });
}
