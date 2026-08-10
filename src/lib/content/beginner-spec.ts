/**
 * `beginner-spec.json`, resolved onto the lexicon and queryable by lexeme id.
 *
 * The spec has existed since the beginner-core tag was introduced, but the
 * product only ever asked it one question - "is this word in the core?" - and
 * threw away everything else: which of the 18 semantic fields a word belongs
 * to, which of the 10 verb functions a verb serves, which dimension an
 * adjective describes. That is exactly the semantic typing a deterministic
 * sentence frame needs to fill a slot safely (a `[NOUN.edible]` slot must not
 * receive `taula`), and it was sitting in the content directory unused.
 *
 * Resolution follows `scripts/verify-beginner-core.ts`'s rule: a multi-word
 * spec entry that has no single lexicon entry of its own (Dari's compound
 * verbs above all - `بازی کردن`, `گپ زدن`) is resolved component-by-component
 * when every component resolves and is teachable on its own, since the
 * construction is productive and a learner who has both parts can build the
 * whole. Every component then carries the field/function/dimension, not just
 * one of them - `بازی` (play) and `کردن` (do) are both legitimately "daily
 * routine" vocabulary, and picking one arbitrarily would throw away real
 * information the other functions in this module need.
 */

import { beginnerSpec, lexiconIndex } from "./load.ts";
import { isTeachable } from "./teachability.ts";
import type { LexiconEntry } from "./schema.ts";

function resolveSpecWord(word: string): LexiconEntry[] {
  const index = lexiconIndex();

  const direct = index.resolve(word);
  if (direct && isTeachable(direct)) return [direct];

  const parts = word.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [];
  const resolved = parts.map((p) => index.resolve(p));
  if (resolved.some((e) => !e || !isTeachable(e))) return [];
  return resolved as LexiconEntry[];
}

/** Build one id -> group-name(s) map from a `word -> group` spec section. */
function invert(section: Record<string, readonly string[]>): Map<string, Set<string>> {
  const out = new Map<string, Set<string>>();
  for (const [group, words] of Object.entries(section)) {
    for (const word of words) {
      for (const entry of resolveSpecWord(word)) {
        let groups = out.get(entry.id);
        if (!groups) out.set(entry.id, (groups = new Set()));
        groups.add(group);
      }
    }
  }
  return out;
}

const semanticFieldSeeds: Record<string, string[]> = Object.fromEntries(
  Object.entries(beginnerSpec.semanticFields).map(([field, { seed }]) => [field, seed]),
);

const closedClassById = invert(beginnerSpec.closedClasses);
const semanticFieldById = invert(semanticFieldSeeds);
const verbFunctionById = invert(beginnerSpec.verbFunctions);
const dimensionById = invert(beginnerSpec.descriptiveDimensions);

const asArray = (s: ReadonlySet<string> | undefined): string[] => (s ? [...s] : []);

/**
 * Which closed classes (subject pronouns, articles, question words, …) a
 * lexeme belongs to. An array, not a single class: real polysemy is common
 * here - Catalan `el` is both an article and a weak pronoun, `en` both a
 * pronoun and a preposition - and collapsing that to one class would make the
 * frame engine block a legitimate use.
 */
export function closedClassOf(lexemeId: string): string[] {
  return asArray(closedClassById.get(lexemeId));
}

/** Which of the spec's semantic fields (Food & Drink, Places & Buildings, …) a lexeme's seed belongs to. */
export function semanticFieldOf(lexemeId: string): string[] {
  return asArray(semanticFieldById.get(lexemeId));
}

/** Which verb functions (motion, transaction, perception, …) a lexeme serves. Empty for non-verbs. */
export function verbFunctionOf(lexemeId: string): string[] {
  return asArray(verbFunctionById.get(lexemeId));
}

/** Which descriptive dimensions (size, temperature, price, taste, …) a lexeme describes. Empty for non-adjectives. */
export function dimensionOf(lexemeId: string): string[] {
  return asArray(dimensionById.get(lexemeId));
}

function wordsOf(map: Map<string, Set<string>>, group: string): LexiconEntry[] {
  const index = lexiconIndex();
  const out: LexiconEntry[] = [];
  for (const [id, groups] of map) {
    if (groups.has(group)) {
      const entry = index.byId.get(id);
      if (entry) out.push(entry);
    }
  }
  return out;
}

/** The seed words for one semantic field, resolved to lexicon entries. */
export function fieldWords(field: string): LexiconEntry[] {
  return wordsOf(semanticFieldById, field);
}

/** The words that serve one verb function, resolved to lexicon entries. */
export function verbFunctionWords(fn: string): LexiconEntry[] {
  return wordsOf(verbFunctionById, fn);
}

/** The words describing one dimension, resolved to lexicon entries. */
export function dimensionWords(dimension: string): LexiconEntry[] {
  return wordsOf(dimensionById, dimension);
}

/** Every semantic field name the spec declares. */
export function semanticFieldNames(): string[] {
  return Object.keys(beginnerSpec.semanticFields);
}

/** Every verb function name the spec declares. */
export function verbFunctionNames(): string[] {
  return Object.keys(beginnerSpec.verbFunctions);
}

/** Every descriptive dimension name the spec declares. */
export function dimensionNames(): string[] {
  return Object.keys(beginnerSpec.descriptiveDimensions);
}

/** Whether the spec types this lexeme at all - in any closed class, field, verb function or dimension. */
export function isSpecTyped(lexemeId: string): boolean {
  return (
    closedClassById.has(lexemeId) ||
    semanticFieldById.has(lexemeId) ||
    verbFunctionById.has(lexemeId) ||
    dimensionById.has(lexemeId)
  );
}
