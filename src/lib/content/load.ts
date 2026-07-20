/**
 * Typed, build-time loaders for the open content files. Content ships in the
 * app bundle, so no network round-trip for lexicon/course/levels.
 */
import alphabetJson from "../../../content/alphabet/course.json";
import lexiconJson from "../../../content/lexicon/lexicon.json";
import levelsJson from "../../../content/levels/levels.json";
import { buildLexiconIndex, type LexiconIndex } from "../text/lexicon-index";
import {
  alphabetCourseSchema,
  levelsFileSchema,
  lexiconFileSchema,
  type AlphabetCourse,
  type Level,
  type LexiconEntry,
  type LexiconFile,
  type LevelsFile,
} from "./schema";

export const lexicon: LexiconFile = lexiconFileSchema.parse(lexiconJson);
export const alphabetCourse: AlphabetCourse = alphabetCourseSchema.parse(alphabetJson);
export const levelsFile: LevelsFile = levelsFileSchema.parse(levelsJson);

export const levels: Level[] = levelsFile.levels;

let index: LexiconIndex | null = null;
export function lexiconIndex(): LexiconIndex {
  index ??= buildLexiconIndex(lexicon.entries);
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
