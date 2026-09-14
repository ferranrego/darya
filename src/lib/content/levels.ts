/**
 * Level definitions - the smallest content module, and the one the app shell
 * reaches.
 *
 * Split out of `load.ts` because that module parsed the whole lexicon on
 * import. Measured on a production build: the Zod-parsed 3.8 MB `lexicon.json`
 * landed in one 3.56 MB (765 KB gzip) client chunk that every authenticated
 * route downloaded, because the `(app)` layout's milestone observer imported
 * `levels` from `load.ts` - and a top-level `.parse()` call is a side effect no
 * bundler can tree-shake. Nothing here may import the lexicon, the grammar
 * course or the language profile; `scripts/check-bundle.ts` fails the build if
 * the lexicon chunk reaches a route that does not need it.
 */
import levelsJson from "@content/levels/levels.json";
import { levelsFileSchema, type Level, type LevelsFile } from "./schema";

export const levelsFile: LevelsFile = levelsFileSchema.parse(levelsJson);

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
