/**
 * Single-answer Dari surface realization for the sentence-frame engine.
 *
 * Mirrors `lang/ca/surface.ts`'s role: `conjugate.ts` and `suppletive.ts`
 * solve resolution (every surface a verb can take, for the lookup index) and
 * this solves generation (exactly one correct surface, for a frame to emit).
 *
 * Three hazards named by the Dari philology review live here:
 *
 *   - **Ezafe** has three orthographic realisations depending on what the
 *     head word ends in, and gets the connector wrong more often than any
 *     other single thing a naive filler does. Consonant-final: nothing is
 *     written at all (برادر من, not *برادرِ من) - the vowel is real in speech
 *     and simply not spelled, which is exactly why a filler that "adds an
 *     ezafe mark" to every head is already wrong for the common case. Vowel-
 *     final (ا/و): a plain ی (دنیای من). Silent-he-final (ه, the majority of
 *     -a nouns): a ZWNJ + ی (خانه‌ی من) - plain ی here would let the two
 *     letters ligature into a shape that reads as a different word.
 *   - **را** marks a definite/specific direct object and is dropped for a
 *     generic or indefinite one - `من سیب را می‌خورم` (the apple) vs `از دکان
 *     نان می‌خرم` (bread, generically). This is not a property of the noun,
 *     it is a property of what the sentence means, so - per the philology
 *     review - a frame must carry it as a distinct slot type
 *     (`noun-definite` vs `noun-generic`), never derive it from the word.
 *   - **Plurals**: ها is the safe default for every noun, human or not, in
 *     ordinary written and spoken Dari; ان exists for (mostly) human nouns
 *     but is optional and register-bound, and Arabic broken plurals are
 *     lexical exceptions belonging to specific loanwords, not a rule. Rather
 *     than guess which of three systems applies, this always produces ها,
 *     which native speakers accept everywhere ان or a broken plural would
 *     also be heard - the same "productive default, list the exceptions"
 *     shape as the Catalan module.
 */

import { ZWNJ } from "./normalize.ts";
import { derivePastStem, VERB_OVERRIDES } from "./conjugate.ts";

export interface Ezafe {
  /** The head word's script form, with its connector attached if it needs one. */
  target: string;
  /** The head word's transliteration, with `-e`/`-ye` attached. */
  translit: string;
}

/** Nouns whose plural is a lexical exception to the ها default - populate as frames need them. */
const IRREGULAR_PLURAL: Record<string, { target: string; translit?: string }> = {
  مرد: { target: "مردان", translit: "mardān" }, // "men" - مردها exists too but مردان is what a beginner text is more likely to meet
};

/** Attach the ezafe connector for "X of Y" / "Y's X" (X is the head this returns). */
export function ezafe(headTarget: string, headTranslit: string): Ezafe {
  if (/ه$/.test(headTarget)) {
    return { target: headTarget + ZWNJ + "ی", translit: `${headTranslit}-ye` };
  }
  if (/[او]$/.test(headTarget)) {
    return { target: headTarget + "ی", translit: `${headTranslit}-ye` };
  }
  return { target: headTarget, translit: `${headTranslit}-e` };
}

/**
 * را, only when the object is definite/specific - a property the frame's
 * slot type decides, never the word itself. `definite: false` returns the
 * noun unchanged, which is the generic-object case (`نان می‌خرم`).
 */
export function withRa(
  nounTarget: string,
  nounTranslit: string,
  definite: boolean,
): { target: string; translit: string } {
  if (!definite) return { target: nounTarget, translit: nounTranslit };
  return { target: `${nounTarget} را`, translit: `${nounTranslit} rā` };
}

export function pluralOf(nounTarget: string, nounTranslit: string): { target: string; translit: string } {
  const irregular = IRREGULAR_PLURAL[nounTarget];
  if (irregular) return { target: irregular.target, translit: irregular.translit ?? nounTranslit };
  return { target: nounTarget + ZWNJ + "ها", translit: `${nounTranslit}-hā` };
}

/** The fixed present-tense copula, register-consistent within one text - suppletive, not conjugated. See suppletive.ts. */
export const COPULA = { "3sg": { target: "است", translit: "ast" } } as const;

export type Person = "1sg" | "2sg" | "3sg";
const PRESENT_ENDING: Record<Person, { target: string; translit: string }> = {
  "1sg": { target: "م", translit: "am" },
  "2sg": { target: "ی", translit: "ē" },
  "3sg": { target: "د", translit: "ad" },
};

/**
 * Present-stem transliterations, keyed by the infinitive's `matchKey`-folded
 * form (same key `VERB_OVERRIDES` uses). Not derivable from the infinitive's
 * own transliteration: present stems are suppletive in the script
 * (`conjugate.ts`'s own header) and so is their pronunciation - رفتن
 * (raftan)'s present stem رو is "raw", not built from "raft" by any rule.
 * Populated only for the verbs the shipped frames actually use; a missing
 * entry fails loudly rather than mistransliterating.
 */
const PRESENT_STEM_TRANSLIT: Record<string, string> = {
  رفتن: "raw",
  خوردن: "khor",
  کردن: "kon",
  دیدن: "bin",
  آمدن: "ā",
  خواستن: "khwāh",
};

/**
 * Present indicative (می‌X) for a regular verb, one person, affirmative only -
 * the form a beginner frame needs. Present stems are suppletive (see
 * `conjugate.ts`'s own header) so both the script form and its
 * transliteration require an authored entry rather than a guess; a verb
 * missing either throws, the same fail-loudly contract as the Catalan
 * module's unauthored forms.
 */
export function presentIndicative(infinitive: string, person: Person): { target: string; translit: string } {
  const key = infinitive.replace(/[آأإ]/g, "ا");
  const override = VERB_OVERRIDES[key];
  const stemTranslit = PRESENT_STEM_TRANSLIT[infinitive];
  if (!override?.presentStem || !stemTranslit) {
    throw new Error(`presentIndicative("${infinitive}"): no presentStem/translit authored for this verb`);
  }
  const past = derivePastStem(infinitive);
  if (!past) throw new Error(`presentIndicative("${infinitive}"): not a دن/تن infinitive`);

  const stem = override.presentStem;
  const ending = PRESENT_ENDING[person];
  return {
    target: `می${ZWNJ}${stem}${ending.target}`,
    translit: `mē${stemTranslit}${ending.translit}`,
  };
}

/**
 * داشتن ("to have") - suppletive in the same way بودن is: its present is
 * bare دارم/داری/دارد, never *می‌دارم (`conjugate.ts`'s own `noMiPresent`
 * flag exists specifically for this verb). `presentIndicative` always
 * prepends می, so داشتن needs its own function rather than a VERB_OVERRIDES
 * entry that function would apply the wrong prefix to.
 */
export function presentOfDashtan(person: Person): { target: string; translit: string } {
  const ending = PRESENT_ENDING[person];
  return { target: `دار${ending.target}`, translit: `dār${ending.translit}` };
}
