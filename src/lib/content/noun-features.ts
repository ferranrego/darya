/**
 * The semantic features a deterministic sentence frame needs to fill a slot
 * safely, derived rather than hand-tagged.
 *
 * A frame with an untyped `[NOUN]` slot produces `el got menja la taula` -
 * grammatically perfect and meaningless, because nothing stopped an
 * inanimate noun from filling a subject only an animate one should. Most of
 * what a frame needs to rule that out is already implicit in
 * `beginner-spec.json`'s semantic fields: a word seeded under "Animals &
 * Pets" is animate by definition, one under "Food & Drink" is edible by
 * definition. Encoding these as functions over `beginner-spec.ts` rather than
 * as new lexicon fields means there is nothing to keep in sync - a word
 * reclassified in the spec is reclassified here automatically, and the
 * lexicon schema stays free of five more optional booleans most entries would
 * never set.
 *
 * `gender` is the one feature that could not be derived this way and lives on
 * the lexicon entry itself - see `scripts/derive-ca-gender.ts` and the note on
 * `lexiconEntrySchema.gender`. Two features remain genuinely untagged:
 * countability (mass vs. count) and container-hood have no semantic field to
 * derive from, `beginner-spec.json`'s own `_note` says so for Objects & Tools,
 * and a frame that needs either is authored content for `scripts/data/frames-
 * *.ts` to supply directly, not a lexicon-wide predicate.
 */

import { semanticFieldOf } from "./beginner-spec.ts";
import type { LexiconEntry } from "./schema.ts";

const PLACE_FIELDS = new Set(["Places & Buildings", "Travel & Transport"]);
const HUMAN_FIELDS = new Set(["Family & Relationships", "People & Identity"]);
const ANIMAL_FIELDS = new Set(["Animals & Pets"]);
const EDIBLE_FIELDS = new Set(["Food & Drink"]);

function hasAnyField(entry: LexiconEntry, fields: ReadonlySet<string>): boolean {
  return semanticFieldOf(entry.id).some((f) => fields.has(f));
}

/** A location a `[LOC]` slot can safely fill - "a la platja", "به بازار". */
export function isPlace(entry: LexiconEntry): boolean {
  return hasAnyField(entry, PLACE_FIELDS);
}

/** A person - the referent a subject/object slot needing a human can safely take. */
export function isHuman(entry: LexiconEntry): boolean {
  return entry.pos === "noun" && hasAnyField(entry, HUMAN_FIELDS);
}

/** A person or an animal - what a perception or motion verb's subject can safely be. */
export function isAnimate(entry: LexiconEntry): boolean {
  return isHuman(entry) || (entry.pos === "noun" && hasAnyField(entry, ANIMAL_FIELDS));
}

/** Something a `menjar`/`beure`-type verb's object can safely be. */
export function isEdible(entry: LexiconEntry): boolean {
  return entry.pos === "noun" && hasAnyField(entry, EDIBLE_FIELDS);
}

/**
 * Grammatical gender for agreement. `undefined` for anything not tagged -
 * every part of speech other than Catalan nouns, adjectives and determiners,
 * and any Catalan noun outside the ~200-word spec-typed set gender has been
 * derived for so far (see `scripts/derive-ca-gender.ts`). A frame must treat
 * `undefined` as "do not use this word in a slot that needs to agree", not as
 * a default gender - guessing produces exactly the wrong-agreement text this
 * module exists to prevent.
 */
export function genderOf(entry: LexiconEntry): "m" | "f" | "common" | undefined {
  return entry.gender;
}
