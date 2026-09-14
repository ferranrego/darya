/**
 * Courses and small content files: the alphabet course, the grammar courses,
 * themes, placement controls and the beginner spec.
 *
 * Deliberately free of the lexicon (see `lexicon.ts`), so the home screen, the
 * grammar tree and the journey map do not download 3.5 MB of vocabulary they
 * never read.
 */
import alphabetJson from "@content/alphabet/course.json";
import grammarJson from "@content/grammar/all.json";
import placementControlsJson from "@content/lexicon/placement-controls.json";
import themesJson from "@content/lexicon/themes.json";
import beginnerSpecJson from "@content/lexicon/beginner-spec.json";
import { GRAMMAR_LEVEL_ORDER, cefrOf } from "./cefr";
import { levels } from "./levels";
import {
  alphabetCourseSchema,
  beginnerSpecSchema,
  grammarCoursesFileSchema,
  placementControlsFileSchema,
  themesFileSchema,
  type AlphabetCourse,
  type BeginnerSpec,
  type GrammarCourse,
  type GrammarLesson,
  type GrammarLevel,
  type PlacementControl,
  type Theme,
} from "./schema";

export const themes: Theme[] = themesFileSchema.parse(themesJson);

/**
 * Invented words mixed into the placement grid to catch over-claiming.
 *
 * Parsed here with everything else so a malformed file fails the build rather
 * than the sign-up. `validate-content.ts` additionally proves none of them
 * resolves through the word engine - the machine-checkable half of "these are
 * not real words".
 */
export const placementControls: PlacementControl[] = placementControlsFileSchema.parse(
  placementControlsJson,
).controls;
export const beginnerSpec: BeginnerSpec = beginnerSpecSchema.parse(beginnerSpecJson);
export const alphabetCourse: AlphabetCourse = alphabetCourseSchema.parse(alphabetJson);

export { GRAMMAR_LEVEL_ORDER, cefrOf, buildJourneyNodes, type JourneyNode } from "./cefr";

/**
 * Every grammar course this language ships, ordered by CEFR level.
 *
 * One barrel file rather than a static import per level: languages start at
 * different points. Dari ships all six; Catalan starts with A1. A hardcoded
 * a1..c2 import list would fail the build on the missing files instead of
 * simply offering fewer levels.
 */
const allGrammarCourses: GrammarCourse[] = grammarCoursesFileSchema
  .parse(grammarJson)
  .courses.sort(
    (a, b) => GRAMMAR_LEVEL_ORDER.indexOf(a.level) - GRAMMAR_LEVEL_ORDER.indexOf(b.level),
  );

/**
 * The course path: every level and block, without `hidden` lessons (see the
 * schema). Everything that draws the map, decides unlock order or counts
 * progress reads this, so a hidden lesson can never be the one a learner is
 * waiting to unlock or the one that keeps a level from reading "complete".
 */
export const grammarCourses: GrammarCourse[] = allGrammarCourses.map((c) => ({
  ...c,
  blocks: c.blocks
    .map((b) => ({ ...b, lessons: b.lessons.filter((l) => !l.hidden) }))
    .filter((b) => b.lessons.length > 0),
}));

/** Lessons on the course path, in course order, flattened across every level and block. */
export const grammarLessons: GrammarLesson[] = grammarCourses.flatMap((c) =>
  c.blocks.flatMap((b) => b.lessons),
);

/**
 * Every lesson, hidden ones included. For lookups by id - a lesson URL, a
 * review card, the practice route - where a learner who already did a hidden
 * lesson must still reach it.
 */
export const allGrammarLessons: GrammarLesson[] = allGrammarCourses.flatMap((c) =>
  c.blocks.flatMap((b) => b.lessons),
);

const lessonLevelById = new Map<string, GrammarLevel>();
for (const course of allGrammarCourses) {
  for (const block of course.blocks) {
    for (const lesson of block.lessons) lessonLevelById.set(lesson.id, course.level);
  }
}

export function grammarLessonById(id: string): GrammarLesson | undefined {
  return allGrammarLessons.find((l) => l.id === id);
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
