/**
 * Typed, build-time loaders for the open content files. Content ships in the
 * app bundle, so no network round-trip for lexicon/course/levels.
 */
import alphabetJson from "../../../content/alphabet/course.json";
import grammarA1Json from "../../../content/grammar/a1.json";
import grammarA2Json from "../../../content/grammar/a2.json";
import grammarB1Json from "../../../content/grammar/b1.json";
import grammarB2Json from "../../../content/grammar/b2.json";
import grammarC1Json from "../../../content/grammar/c1.json";
import grammarC2Json from "../../../content/grammar/c2.json";
import lexiconJson from "../../../content/lexicon/lexicon.json";
import themesJson from "../../../content/lexicon/themes.json";
import levelsJson from "../../../content/levels/levels.json";
import { buildIndex, type LexiconIndex } from "../text";
import {
  alphabetCourseSchema,
  grammarCourseSchema,
  levelsFileSchema,
  lexiconFileSchema,
  type AlphabetCourse,
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
export const alphabetCourse: AlphabetCourse = alphabetCourseSchema.parse(alphabetJson);
export const levelsFile: LevelsFile = levelsFileSchema.parse(levelsJson);

/**
 * The grammar courses that ship today, ordered by CEFR level. B1/B2 are
 * authored but not yet wired in; add their imports here when ready.
 */
export const grammarCourses: GrammarCourse[] = [
  grammarCourseSchema.parse(grammarA1Json),
  grammarCourseSchema.parse(grammarA2Json),
  grammarCourseSchema.parse(grammarB1Json),
  grammarCourseSchema.parse(grammarB2Json),
  grammarCourseSchema.parse(grammarC1Json),
  grammarCourseSchema.parse(grammarC2Json),
];

/** Canonical CEFR order, used for indexing even before every level ships. */
export const GRAMMAR_LEVEL_ORDER: GrammarLevel[] = ["A1", "A2", "B1", "B2", "C1", "C2"];

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
 * The grammar level a learner starts at, from their assessed level_estimate
 * (L1…L6). Levels below this are treated as already completed and hidden, so a
 * learner who tested into A2 begins at A2 with A1 marked done. Clamped to the
 * highest level that actually has content, so a B1/B2 learner starts at the
 * top available course (A2 today) instead of an empty screen.
 */
export function grammarStartLevel(levelEstimate: string | null | undefined): GrammarLevel {
  let desired: GrammarLevel;
  switch (levelEstimate) {
    case "L3":
      desired = "A2";
      break;
    case "L4":
      desired = "B1";
      break;
    case "L5":
      desired = "B2";
      break;
    case "L6":
      desired = "C1"; // C1 is the top assessed level; C2 is only earned by progressing
      break;
    default:
      desired = "A1"; // L1 (pre-A1), L2 (A1), or unknown
  }
  const available = grammarCourses.map((c) => c.level);
  const maxAvailableIdx = Math.max(...available.map((l) => GRAMMAR_LEVEL_ORDER.indexOf(l)));
  const desiredIdx = GRAMMAR_LEVEL_ORDER.indexOf(desired);
  return GRAMMAR_LEVEL_ORDER[Math.min(desiredIdx, maxAvailableIdx)];
}

export const levels: Level[] = levelsFile.levels;

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

export function getWordsByLevel(cefrHint: string): LexiconEntry[] {
  const levelIndex = levels.findIndex((l) => l.cefrHint === cefrHint);
  if (levelIndex === -1) return [];

  const maxRank = levels[levelIndex].entryKnownWords;
  const minRank = levelIndex > 0 ? levels[levelIndex - 1].entryKnownWords : 0;

  return lexicon.entries.filter((entry) => {
    return entry.freqRank > minRank && entry.freqRank <= maxRank;
  });
}

export function getThemesForLevel(cefrHint: string): string[] {
  const words = getWordsByLevel(cefrHint);
  const themes = new Set<string>();
  
  words.forEach((word) => {
    if (word.tags && word.tags.length > 0) {
      word.tags.forEach((tag) => themes.add(tag));
    } else {
      themes.add("Core Vocabulary");
    }
  });

  return Array.from(themes).sort();
}

export function getWordsByTheme(cefrHint: string, theme: string): LexiconEntry[] {
  const words = getWordsByLevel(cefrHint);
  return words.filter((word) => {
    if (theme === "Core Vocabulary") {
      return !word.tags || word.tags.length === 0;
    }
    return word.tags?.includes(theme);
  });
}

export function getWordsByThemeOnly(theme: string): LexiconEntry[] {
  return lexicon.entries.filter((word) => {
    return word.tags?.includes(theme);
  });
}
