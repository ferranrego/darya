/**
 * Turn a level's vocabulary into an ordered curriculum: which words a text
 * should introduce, and which recent words it should reuse.
 *
 * Today a learner gets "any unread text at this level" - `text-pool.ts` picks
 * whichever seed comes first by `seq`, but nothing decided what that `seq`
 * order *should* be or which words belong together. A `Slot` is that
 * decision, made once per level rather than once per text: group the level's
 * new vocabulary by the scene it belongs to (so a text has something to be
 * *about*, the same problem `scene.ts` solves for a single text), and note
 * which earlier words are due back in (PEDAGOGY §7 - 6-12 encounters, not
 * one-and-done).
 *
 * This module only produces the schedule. Drafting a text per slot is a
 * separate, offline, model-touching step - keeping this file pure and
 * model-free is what lets it be unit-tested against real content with no
 * network and no cost.
 */

import { defaultRecipes, type SceneRecipe } from "./scene.ts";
import { closedClassOf, dimensionWords, fieldWords, verbFunctionWords } from "./beginner-spec.ts";
import { levelVocabulary } from "./level-vocabulary.ts";
import { PRS_IRANIAN_WORDS } from "./text-checks.ts";
import { CONTENT_POS } from "./word-selection.ts";
import { profile } from "../lang/index.ts";
import type { LexiconEntry, Level } from "./schema.ts";

export interface Slot {
  seq: number;
  /** Scene id this slot's words came from, or null for the leftover tail. */
  scene: string | null;
  /** Lexeme ids this slot should introduce. */
  introduces: string[];
  /** Lexeme ids from recent slots this text should reuse. */
  reuses: string[];
}

/**
 * How many new words one text can carry. Matches `targetCountFor`'s beginner
 * ceiling of 4 loosely rounded up: a slot is a curriculum unit, not a single
 * generation request, and it is easier to under-fill a slot in a draft than
 * to reopen the schedule to split one that was too ambitious.
 */
const INTRODUCTIONS_PER_SLOT = 5;

/** PEDAGOGY §7: incidental acquisition needs roughly 6-12 encounters. */
const REUSE_COUNT = 3;

/**
 * How many prior slots a slot may pull `reuses` from, indexed by the level's
 * position (L1 = index 0). A learner has fewer words behind them at L1, so
 * the window is narrower - by L4 there is enough history that a fixed window
 * of 5 slots (~25 words) reliably contains something worth reusing without
 * reaching so far back that "recent" stops meaning anything.
 */
const LOOKBACK_BY_LEVEL_INDEX = [3, 4, 5]; // L1, L2, L3
const DEFAULT_LOOKBACK = 5; // L4 and above

/**
 * Content words only - PEDAGOGY §5: closed classes (articles, pronouns,
 * prepositions) are absorbed on sight, not taught, so they never occupy a
 * slot's `introduces`. `levelVocabulary` already mixes them in via the
 * beginner-core tag (a learner needs `jo`/`این` day one), so this filter is
 * what keeps the schedule from spending a slot teaching "the".
 *
 * Grammatical POS alone is not enough: `beginner-spec.json` also lists
 * closed-class *content*-looking words - month and day names, quantifiers
 * like `molt`, place adverbs like `esquerra` - that the lexicon still tags
 * `noun`/`adverb`. Measured on the shipped Catalan and Dari lexicons, that
 * gap alone put a third of L1's schedule into scene-less trailing slots
 * (`gener`, `diumenge`, `on`, `massa`, ...), so `closedClassOf` is checked
 * too, matching the set `build-seed-texts.ts` already absorbs.
 *
 * `CONTENT_POS` itself is `word-selection.ts`'s - imported rather than
 * redeclared, so the two files cannot silently drift onto different sets.
 */

function levelIndexOf(level: Level): number {
  // Ids are "L1".."L8", assigned in curriculum order (schema comment on
  // `levelSchema.id`), so the numeric suffix minus one is the level's index
  // without needing the caller to pass the whole `levels` array through.
  return Number(level.id.slice(1)) - 1;
}

function lookbackFor(level: Level): number {
  return LOOKBACK_BY_LEVEL_INDEX[levelIndexOf(level)] ?? DEFAULT_LOOKBACK;
}

/**
 * `reuses` for the slot about to be appended at index `slots.length`: up to
 * `REUSE_COUNT` ids from the `introduces` of the last `lookback` slots,
 * preferring the least recently used - i.e. drawn from the oldest slot in the
 * window first, since that word has gone longest without being reused.
 */
function reusesFor(priorSlots: readonly Slot[], level: Level): string[] {
  const lookback = lookbackFor(level);
  const from = Math.max(0, priorSlots.length - lookback);
  const window = priorSlots.slice(from);
  return window.flatMap((s) => s.introduces).slice(0, REUSE_COUNT);
}

/** Every lexeme the spec ties to a recipe's fields, verb functions or dimensions, deduped. */
function recipeWords(recipe: SceneRecipe): LexiconEntry[] {
  const seen = new Set<string>();
  const out: LexiconEntry[] = [];
  for (const list of [
    recipe.fields.flatMap(fieldWords),
    (recipe.verbFunctions ?? []).flatMap(verbFunctionWords),
    (recipe.dimensions ?? []).flatMap(dimensionWords),
  ]) {
    for (const e of list) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
    }
  }
  return out;
}

export function scheduleFor(
  level: Level,
  previous: Level | null,
  entries: readonly LexiconEntry[],
  isUsable: (e: LexiconEntry) => boolean,
): Slot[] {
  const known = previous
    ? new Set(levelVocabulary(previous, entries, isUsable).map((e) => e.id))
    : new Set<string>();

  // Ordered by freqRank (levelVocabulary's own sort), so within a scene the
  // round-robin below already picks the most frequent still-unscheduled
  // words first without needing to re-sort per scene.
  const pool = new Map<string, LexiconEntry>();
  for (const e of levelVocabulary(level, entries, isUsable)) {
    if (known.has(e.id) || !CONTENT_POS.has(e.pos)) continue;
    if (closedClassOf(e.id).length > 0) continue;
    // A word `checkInterference` would reject on sight must never be assigned
    // as something to teach - found when a hand-authored Dari L2 text was
    // scheduled `بزرگ` (Iranian Persian "big") as a required target and the
    // check correctly rejected it. `کلان`, the Afghan word, is a separate
    // lexicon entry and stays eligible.
    if (profile.code === "prs" && PRS_IRANIAN_WORDS.includes(e.target)) continue;
    pool.set(e.id, e);
  }

  const recipes = defaultRecipes();
  const scheduled = new Set<string>();
  const slots: Slot[] = [];

  // Round-robin: one pass over every scene emits at most one slot per scene,
  // then repeats until a full pass adds nothing. This is what keeps the
  // schedule from exhausting one scene's whole vocabulary before touching the
  // next - a learner meets a spread of topics early rather than "Food & Drink"
  // for the first thirty words.
  //
  // Candidates come from the recipe's raw field/verb-function/dimension
  // membership (`recipeWords`), not from `scenesFor`'s realized `Scene.words`.
  // `buildScene` caps a scene at 45 words and fills it by ascending freqRank
  // across the level's *whole* cumulative vocabulary, so at any level past
  // the first, lower-level words already known fill the cap first and a
  // level's own new words never appear in it - measured as 100% of L2's
  // Catalan slots landing scene-less before this fix. `pool` above is already
  // the correct level-specific restriction, so membership alone is enough.
  let progressed = true;
  while (scheduled.size < pool.size && progressed) {
    progressed = false;
    for (const recipe of recipes) {
      if (scheduled.size >= pool.size) break;

      const candidates = recipeWords(recipe)
        .filter((e) => pool.has(e.id) && !scheduled.has(e.id))
        .sort((a, b) => a.freqRank - b.freqRank)
        .slice(0, INTRODUCTIONS_PER_SLOT);

      if (candidates.length === 0) continue; // scene can contribute nothing this pass

      progressed = true;
      for (const c of candidates) scheduled.add(c.id);
      slots.push({
        seq: slots.length + 1,
        scene: recipe.id,
        introduces: candidates.map((e) => e.id),
        reuses: reusesFor(slots, level),
      });
    }
  }

  // Honest degradation: words no scene recipe reaches still have to be
  // taught somewhere, so they get trailing slots grouped by freqRank instead
  // of being silently dropped from the curriculum.
  const leftover = [...pool.values()]
    .filter((e) => !scheduled.has(e.id))
    .sort((a, b) => a.freqRank - b.freqRank);

  for (let i = 0; i < leftover.length; i += INTRODUCTIONS_PER_SLOT) {
    const chunk = leftover.slice(i, i + INTRODUCTIONS_PER_SLOT);
    slots.push({
      seq: slots.length + 1,
      scene: null,
      introduces: chunk.map((e) => e.id),
      reuses: reusesFor(slots, level),
    });
  }

  return slots;
}
