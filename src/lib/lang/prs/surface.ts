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
import { derivePastStem, PREFIX_TRANSLIT, takesEpenthesis, VERB_OVERRIDES } from "./conjugate.ts";

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
/**
 * The 2sg ending ی is the long vowel -ī (mēkhurī, dārī), the app-wide
 * convention the lexicon, `spoken.ts`, the course and the hub all write. This
 * table said -ē, the indefinite's vowel, and the test locked it in as
 * `mēkhorē` - with an Iranian short o in the stem as well.
 */
const PRESENT_ENDING: Record<Person, { target: string; translit: string }> = {
  "1sg": { target: "م", translit: "am" },
  "2sg": { target: "ی", translit: "ī" },
  "3sg": { target: "د", translit: "ad" },
};

/**
 * Present indicative (می‌X) for a regular verb, one person, affirmative only -
 * the form a beginner frame needs. Present stems are suppletive (see
 * `conjugate.ts`'s own header) so both the script form and its
 * transliteration require an authored entry rather than a guess; a verb
 * missing either throws, the same fail-loudly contract as the Catalan
 * module's unauthored forms.
 *
 * Three hazards this used to get wrong, all fixed by reusing exactly what
 * `conjugate.ts`/`lexicon-index.ts` already know rather than re-deriving it,
 * so the authoring brief and the resolver can never disagree:
 *
 *   - **Compound verbs** (دوست داشتن، بیدار شدن) conjugate their light verb
 *     only - the carrier (دوست، بیدار) is invariant and must be re-attached.
 *     `VERB_OVERRIDES` is keyed by the light verb's own infinitive (the last
 *     space-separated token), the same lookup `buildGeneratedForms` does.
 *   - **Prefixed verbs** (برگشتن) attach their prefix outside می، not
 *     replacing it (برمی‌گردد, never *می‌گردد) - `VERB_OVERRIDES`' `prefix`
 *     field, previously computed as `override` and then never read.
 *   - **The epenthetic ی** (`takesEpenthesis`, exported from `conjugate.ts`)
 *     was not applied here at all: گفتن/آمدن's vowel-final stems produced
 *     می‌گود/می‌آد instead of می‌گوید/می‌آید.
 *
 * `VERB_OVERRIDES`' `presentStemTranslit` (script stem AND its reading, both
 * keyed to the light verb) takes precedence over whatever the calling entry
 * authored, for the same reason its `presentStem` already did: a compound's
 * own entry can carry a stale copy of the light verb's data - بیدار شدن's
 * entry said "shō" where شدن's own entry says "shaw", which is what actually
 * surfaced (mēshōad) until this was applied. A carrier's own translit still
 * has to come from the entry (`entry.translit`, split the same way as the
 * target), since `VERB_OVERRIDES` only ever knows light verbs.
 */
export function presentIndicative(
  entry: {
    target: string;
    targetNormalized?: string;
    translit?: string | null;
    presentStem?: string;
    presentStemTranslit?: string;
  },
  person: Person
): { target: string; translit: string } {
  const infinitive = entry.targetNormalized ?? entry.target;
  const parts = infinitive.split(" ");
  const lightInfinitive = parts.at(-1)!;
  const carrierTarget = parts.length > 1 ? parts.slice(0, -1).join(" ") : "";

  const key = lightInfinitive.replace(/[آأإ]/g, "ا");
  const override = VERB_OVERRIDES[key];
  if (override?.skip) {
    throw new Error(`presentIndicative("${infinitive}"): ${lightInfinitive} is suppletive, has no derivable present`);
  }

  const past = derivePastStem(lightInfinitive);
  if (!past) throw new Error(`presentIndicative("${infinitive}"): not a دن/تن infinitive`);

  const stem = override?.presentStem ?? entry.presentStem;
  const stemTranslit = override?.presentStemTranslit ?? entry.presentStemTranslit;
  if (!stem || !stemTranslit) {
    throw new Error(`presentIndicative("${infinitive}"): no presentStem/translit authored for this verb`);
  }

  const prefix = override?.prefix ?? "";
  const prefixTranslit = prefix ? PREFIX_TRANSLIT[prefix] : "";
  if (prefix && !prefixTranslit) {
    throw new Error(`presentIndicative("${infinitive}"): no transliteration authored for prefix "${prefix}"`);
  }

  let carrierTranslit = "";
  if (carrierTarget) {
    if (!entry.translit) {
      throw new Error(`presentIndicative("${infinitive}"): compound verb has no translit authored for its carrier`);
    }
    // entry.translit mirrors entry.target's structure - all tokens but the
    // last (the light verb's own infinitive translit, unused here) are the
    // carrier's.
    carrierTranslit = entry.translit.split(" ").slice(0, -1).join(" ");
  }

  const glide = takesEpenthesis(stem);
  const stemForm = stem + (glide ? "ی" : "");
  const stemTranslitForm = stemTranslit + (glide ? "y" : "");
  const ending = PRESENT_ENDING[person];

  const core = override?.noMiPresent
    ? `${prefix}${stemForm}${ending.target}`
    : `${prefix}می${ZWNJ}${stemForm}${ending.target}`;
  const coreTranslit = override?.noMiPresent
    ? `${prefixTranslit}${stemTranslitForm}${ending.translit}`
    : `${prefixTranslit}mē${stemTranslitForm}${ending.translit}`;

  return {
    target: carrierTarget ? `${carrierTarget} ${core}` : core,
    translit: carrierTranslit ? `${carrierTranslit} ${coreTranslit}` : coreTranslit,
  };
}

/**
 * داشتن ("to have") - suppletive in the same way بودن is: its present is
 * bare دارم/داری/دارد, never *می‌دارم (`conjugate.ts`'s own `noMiPresent`
 * flag exists specifically for this verb, and `presentIndicative` now
 * honours it via `VERB_OVERRIDES` - including for compounds built on
 * داشتن, e.g. دوست داشتن → دوست دارد, never *دوست می‌دارد). This standalone
 * helper predates that and is kept as the simpler call for the bare verb,
 * where no compound carrier or lexicon entry is in scope.
 */
export function presentOfDashtan(person: Person): { target: string; translit: string } {
  const ending = PRESENT_ENDING[person];
  return { target: `دار${ending.target}`, translit: `dār${ending.translit}` };
}

/**
 * A one-line inflection hint for an authoring brief. See the Catalan twin in
 * `lang/ca/surface.ts` for why this lives beside the language rather than in
 * the shared authoring script.
 *
 * Dari hints carry a transliteration, so a noun without one is skipped rather
 * than rendered half-transliterated.
 */
export function inflectionHint(entry: {
  target: string;
  targetNormalized?: string;
  pos: string;
  translit?: string | null;
  presentStemTranslit?: string;
}): string | null {
  try {
    if (entry.pos === "verb" && entry.target === "داشتن") {
      const form = presentOfDashtan("3sg");
      return `${entry.target} -> ${form.target} (${form.translit})`;
    }
    if (entry.pos === "verb") {
      const form = presentIndicative(entry, "3sg");
      return `${entry.target} -> ${form.target} (${form.translit})`;
    }
    if (entry.pos === "noun" && entry.translit) {
      const form = pluralOf(entry.target, entry.translit);
      return `${entry.target} -> ${form.target} (${form.translit}, plural)`;
    }
  } catch {
    return null;
  }
  return null;
}
