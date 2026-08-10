/**
 * A coherent, picturable word set a text can be built from, replacing "theme".
 *
 * The generator used to hand a beginner text a `theme` string ("Shopping",
 * "Food") that never even reached the beginner prompt, plus a 120-word
 * vocabulary slice ordered by raw frequency. Measured against the shipped
 * Catalan lexicon, that slice held 18 nouns, of which about a dozen were
 * concrete - `home, fill, casa, persona, sol, família, pare, ciutat, mare,
 * terra, mà, poble` - and the model was then asked to write about `escriure,
 * carrer, estrella, ros`. There is no scene containing a street, a star and a
 * blonde person built only from those nouns, so the request was never
 * satisfiable.
 *
 * A scene is the fix: a semantic field (or a few) from `beginner-spec.json`,
 * resolved through `beginner-spec.ts` into an actual, level-appropriate word
 * set of the size a short text needs. "Kitchen" is a scene; "Shopping" was a
 * label with nothing behind it.
 */

import { dimensionWords, fieldWords, verbFunctionWords } from "./beginner-spec.ts";
import { levelVocabulary } from "./level-vocabulary.ts";
import { teachablePool } from "./word-selection.ts";
import type { LexiconEntry, Level } from "./schema.ts";

/** A scene as authored content: which parts of the spec it draws from. */
export interface SceneRecipe {
  id: string;
  fields: string[];
  verbFunctions?: string[];
  dimensions?: string[];
}

export interface Scene {
  id: string;
  fields: string[];
  verbFunctions: string[];
  dimensions: string[];
  /** Resolved, level-appropriate, frequency-ordered. 25-45 words when built. */
  words: LexiconEntry[];
}

/**
 * A scene needs enough vocabulary to write several independent sentences
 * about, and a cap for the same reason `selectKnown` caps the prompt slice: a
 * list this long is still short enough for a model to read carefully.
 */
const MIN_SCENE_WORDS = 25;
const MAX_SCENE_WORDS = 45;

/**
 * Fill a recipe against one level's reachable vocabulary.
 *
 * "Reachable" is `levelVocabulary` (assumed known) plus `teachablePool`
 * (newly teachable at this level) - a scene has to serve both roles, since the
 * words a text draws from and the words it might newly teach are the same
 * pool split two different ways downstream. Returns null rather than a
 * half-empty scene when the recipe cannot reach the minimum at this level: a
 * caller should try a different recipe, not receive an unsatisfiable one -
 * the same lesson `selectTargets` already encodes for target words.
 *
 * Growing with the level rather than shrinking to fit it is deliberate: the
 * same recipe reaches more of a semantic field's vocabulary at A2 than at
 * pre-A1, which is what "richer scene, same topic" means in practice.
 */
export function buildScene(
  recipe: SceneRecipe,
  level: Level,
  entries: readonly LexiconEntry[],
  isUsable: (e: LexiconEntry) => boolean,
): Scene | null {
  const reachable = new Set(
    [
      ...levelVocabulary(level, entries, isUsable),
      ...teachablePool(entries, level, () => false, isUsable),
    ].map((e) => e.id),
  );

  const byFreq = (list: LexiconEntry[]) =>
    list.filter((e) => isUsable(e) && reachable.has(e.id)).sort((a, b) => a.freqRank - b.freqRank);

  /**
   * Fields first, then verb functions, then dimensions - never one flat
   * frequency sort across all three.
   *
   * `existence and state`, `possession` and `daily routine` are shared across
   * every recipe (a kitchen scene and a weather scene both need "to be" and
   * "to have"), and those verbs are far higher-frequency than most field
   * vocabulary. Sorting the combined pool by frequency alone let them fill
   * the 45-word cap before a scene's own topic did - every scene opened with
   * `ser, haver, estar, tenir, hi, gran, nou, viure` and the field-specific
   * words that make it a *scene* were pushed past the cut. Each source is
   * ranked and deduped on its own and only concatenated after, so a rich
   * field is never crowded out by the generic verbs meant to be padding for a
   * thin one.
   */
  const dimensionEntries = byFreq((recipe.dimensions ?? []).flatMap(dimensionWords));

  const seen = new Set<string>();
  const ordered: LexiconEntry[] = [];
  for (const list of [byFreq(recipe.fields.flatMap(fieldWords)), byFreq((recipe.verbFunctions ?? []).flatMap(verbFunctionWords)), dimensionEntries]) {
    for (const e of list) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      ordered.push(e);
    }
  }

  if (ordered.length < MIN_SCENE_WORDS) return null;

  const words = ordered.slice(0, MAX_SCENE_WORDS);

  return {
    id: recipe.id,
    fields: recipe.fields,
    verbFunctions: recipe.verbFunctions ?? [],
    dimensions: recipe.dimensions ?? [],
    words,
  };
}

/**
 * One recipe per semantic field, each paired with the verb functions and
 * dimensions a scene about that field actually needs - a kitchen scene needs
 * "daily routine" and "manipulation" verbs and the "temperature"/"taste"
 * dimensions, not "transaction" or "courage".
 *
 * A starting set, not the final one: `content/<lang>/lexicon/scenes.json` is
 * where hand-curated, multi-field recipes belong once they exist (a scene
 * that mixes "Family" with "Home & Furniture" reads better than either
 * alone), reviewed the way any other content is. This is what lets the
 * product run - and be tested - before that file is authored.
 */
/**
 * Which dimensions actually fit a field's own nouns, so a filled sentence
 * says something plausible rather than merely grammatical - "l'aigua és
 * gran" (the water is big) parses fine and describes nothing anyone would
 * say. `beginner-spec.json` does not encode which noun classes a dimension
 * applies to (the philology review named this a real gap), so this is a
 * small hand-authored fit table rather than a derived one - the same
 * "author what cannot be derived" rule as `noun-features.ts`'s account of
 * countability and container-hood.
 */
const DIMENSIONS_BY_FIELD: Record<string, string[]> = {
  "Family & Relationships": ["age", "build", "size", "evaluation"],
  "Body & Health": ["size", "strength", "age", "height", "weight"],
  "Food & Drink": ["taste", "temperature", "price", "fullness", "moisture"],
  "Home & Furniture": ["size", "age", "colour", "openness"],
  "Clothing & Fashion": ["colour", "size", "price", "moisture"],
  "Animals & Pets": ["size", "colour", "age", "weight", "courage"],
  "Colors & Shapes": ["size", "shape", "brightness", "colour"],
  "Weather & Climate": ["temperature", "brightness", "strength", "moisture"],
  "Time & Calendar": ["speed", "order"],
  "Places & Buildings": ["size", "distance", "age", "height", "openness"],
  "Travel & Transport": ["speed", "distance", "price", "weight"],
  "Work & Education": ["difficulty", "price", "order", "correctness"],
  "Objects & Tools": ["size", "price", "hardness", "weight", "openness"],
  "Emotions & Feelings": ["emotion", "strength", "evaluation"],
  "Nature & Environment": ["size", "colour", "temperature", "height", "moisture"],
  "People & Identity": ["age", "build", "mind", "height", "weight", "evaluation", "courage"],
  "Leisure & Culture": ["difficulty", "price", "emotion", "evaluation"],
  "Health & Illness": ["strength", "cleanliness", "weight", "evaluation"],
};

/**
 * Which of `beginner-spec.json`'s 10 verb functions, beyond the three every
 * scene shares below, actually belong to a field - a travel scene needs
 * "motion" verbs, a shopping-adjacent one needs "transaction". Without this,
 * `defaultRecipes` only ever drew on 3 of the 10 categories, so verbs like
 * `anar`, `veure`, `comprar` (motion, perception, transaction) could never
 * appear in *any* scene regardless of level - measured as a third of L1's
 * Catalan and Dari schedules landing in scene-less leftover slots, almost
 * all of them exactly these verbs. Same hand-authored-fit-table rule as
 * `DIMENSIONS_BY_FIELD` above.
 */
const VERB_FUNCTIONS_BY_FIELD: Record<string, string[]> = {
  "Family & Relationships": ["communication", "cognition and volition"],
  "Body & Health": ["perception", "manipulation"],
  "Food & Drink": ["manipulation", "transaction"],
  "Home & Furniture": ["manipulation"],
  "Clothing & Fashion": ["transaction", "manipulation"],
  "Animals & Pets": ["perception", "motion"],
  "Colors & Shapes": ["perception"],
  "Weather & Climate": ["weather and impersonal"],
  "Time & Calendar": ["motion", "cognition and volition"],
  "Places & Buildings": ["motion"],
  "Travel & Transport": ["motion", "transaction"],
  "Work & Education": ["transaction", "cognition and volition", "communication"],
  "Objects & Tools": ["manipulation", "transaction"],
  "Emotions & Feelings": ["cognition and volition", "perception"],
  "Nature & Environment": ["perception", "weather and impersonal"],
  "People & Identity": ["cognition and volition", "communication"],
  "Leisure & Culture": ["perception", "communication", "motion"],
  "Health & Illness": ["perception", "manipulation"],
};

const SHARED_VERB_FUNCTIONS = ["existence and state", "possession", "daily routine"];

export function defaultRecipes(): SceneRecipe[] {
  return Object.entries(DIMENSIONS_BY_FIELD).map(([field, dimensions]) => ({
    id: field,
    fields: [field],
    verbFunctions: [...SHARED_VERB_FUNCTIONS, ...(VERB_FUNCTIONS_BY_FIELD[field] ?? [])],
    dimensions,
  }));
}

/** Every default recipe that reaches the minimum size at this level. */
export function scenesFor(
  level: Level,
  entries: readonly LexiconEntry[],
  isUsable: (e: LexiconEntry) => boolean,
): Scene[] {
  return defaultRecipes()
    .map((recipe) => buildScene(recipe, level, entries, isUsable))
    .filter((s): s is Scene => s !== null);
}
