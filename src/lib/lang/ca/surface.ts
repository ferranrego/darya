/**
 * Single-answer Catalan surface realization for the sentence-frame engine.
 *
 * `lexicon-index.ts`'s `nominalForms` solves a different problem: given a
 * lemma, generate every plausible inflected spelling so a learner tapping any
 * of them resolves to the right entry. Over-generating there is free - a
 * spurious candidate is inert. A frame filler needs the opposite: exactly one
 * form, and a wrong one is not inert, it is the defect this whole engine
 * exists to prevent. The two are deliberately separate implementations of
 * related rules rather than one over-generating function pressed into a role
 * it was not built for; `surface.test.ts` cross-checks that every form this
 * module emits is one `nominalForms` would also accept, so the two cannot
 * silently diverge on a word both cover.
 *
 * Two things below are genuinely ambiguous from spelling alone - Catalan
 * itself does not decide them by rule - and `nominalForms`'s own comments say
 * so. Each is handled by defaulting to the *productive* case and listing the
 * smaller closed class of exceptions in `IRREGULAR_FEMININE` /
 * `IRREGULAR_PLURAL`:
 *
 *   - -t feminines: most are the plain case (petit -> petita); devoicing
 *     (cansat -> cansada) is specifically a participle used as an adjective,
 *     a smaller and closed-enough class to list rather than detect.
 *   - stressed-final-vowel plurals: whether the written accent survives
 *     (germans, not *germàns, but béns, not *bens) is listed rather than
 *     guessed, and the function throws for anything in that shape not yet
 *     listed - a frame author gets a clear failure at authoring time rather
 *     than a silently wrong sentence at runtime.
 */

import { attach, stemOf } from "./conjugate.ts";

export type Gender = "m" | "f";
export type Number_ = "sg" | "pl";
export type Person = "1sg" | "2sg" | "3sg";

/**
 * Adjectives and nouns whose feminine cannot be read off the spelling.
 * Populate as frames need them; each entry is a decision a philologist should
 * check, not a guess this module makes silently.
 */
const IRREGULAR_FEMININE: Record<string, string> = {
  cansat: "cansada",
  cansada: "cansada",
  animat: "animada",
  educat: "educada",
  casat: "casada",
  gelat: "gelada",
  tancat: "tancada",
  obert: "oberta", // -rt devoices too (obert -> oberta, not *oberda; irregular enough to author directly)
};

/**
 * Nouns/adjectives whose plural is not the regular rule's answer - the
 * stressed-final-vowel case the regular rule refuses to guess (see the
 * `pluralOf` throw below), plus `mà`, whose plural consonant is irregular
 * outright (mans, not *màs).
 */
const IRREGULAR_PLURAL: Record<string, string> = {
  germà: "germans",
  mà: "mans",
  país: "països",
  bé: "béns",
};

/**
 * Adjective classes that take no feminine at all - "una decisió important",
 * never "importanta". Mirrors `lexicon-index.ts`'s `invariantAdjective`
 * table, sourced the same way (DIEC2-derived, philologist-reviewed): -ble/
 * -erior have no exceptions; -ar/-al/-nt/-il each have a short closed list of
 * words that look like they belong but actually inflect.
 */
const AR_EXCEPTIONS = new Set([
  "car", "clar", "rar", "avar", "bàrbar", "búlgar", "ignar", "ovípar", "tàrtar", "zíngar",
]);
const AL_EXCEPTIONS = new Set(["mal", "anòmal", "col·legial", "provençal"]);
const NT_EXCEPTIONS = new Set([
  "content", "calent", "valent", "dolent", "lent", "sant", "tant", "quant", "atent",
  "violent", "virulent", "comboiant", "corpulent", "cruent", "fraudulent", "incruent",
  "opulent", "pulverulent", "purulent", "somnolent", "suculent",
]);

/**
 * Common adjectives invariant for gender that fall outside the suffix classes
 * above - `gran` (un home gran / una dona gran) and `jove` (un noi jove / una
 * noia jove) do not end in -ble/-ar/-al/-nt/-il, so the pattern rules below
 * would never flag them, and they are frequent enough that a beginner text is
 * likely to need one. Named explicitly rather than guessed at, the same as
 * every other entry in this file.
 */
const ADDITIONAL_INVARIANT = new Set(["gran", "jove"]);

function isInvariantAdjective(lemma: string): boolean {
  return (
    ADDITIONAL_INVARIANT.has(lemma) ||
    /[aeiou]ble$/.test(lemma) ||
    /erior$/.test(lemma) ||
    (/ar$/.test(lemma) && !AR_EXCEPTIONS.has(lemma)) ||
    (/al$/.test(lemma) && !AL_EXCEPTIONS.has(lemma)) ||
    (/nt$/.test(lemma) && !NT_EXCEPTIONS.has(lemma)) ||
    (/il$/.test(lemma) && !/òfil$/.test(lemma) && lemma !== "tranquil")
  );
}

/** The lemma's feminine singular, or the lemma itself if the adjective is invariant. */
export function feminineOf(lemma: string): string {
  if (IRREGULAR_FEMININE[lemma]) return IRREGULAR_FEMININE[lemma];
  if (isInvariantAdjective(lemma)) return lemma;
  if (lemma === "tranquil") return "tranquil·la";
  if (/o$/.test(lemma)) return lemma.slice(0, -1) + "a"; // bo -> bona is irregular; plain -o -> -a is the regular case
  if (/e$/.test(lemma)) return lemma.slice(0, -1) + "a"; // pobre -> pobra
  if (/u$/.test(lemma)) return lemma.slice(0, -1) + "va"; // blau -> blava
  if (/ig$/.test(lemma)) return lemma.slice(0, -2) + "ja"; // roig -> roja
  if (/ós$/.test(lemma)) return lemma.slice(0, -2) + "osa"; // gustós -> gustosa
  if (/c$/.test(lemma)) return lemma.slice(0, -1) + "ca"; // ric -> rica
  if (/ç$/.test(lemma)) return lemma.slice(0, -1) + "ça"; // feliç -> feliça (feminine sg, distinct from the plural feliços/felices)
  // -t, including -nt: the productive case is plain +a (petit -> petita,
  // content -> contenta - content only reaches here because the
  // NT_EXCEPTIONS check above already confirmed it inflects). Devoicing
  // (cansat -> cansada) is the closed, smaller class - a participle used as
  // an adjective - and is looked up in IRREGULAR_FEMININE before any of this
  // function's rules run, so it never reaches this default.
  if (/t$/.test(lemma)) return lemma + "a";
  // Any other consonant ending this file has reasoned about explicitly - -l,
  // -r, -s, -d, -m - is the safe, productive `+a` case (clar -> clara,
  // normal -> normala once the AL_EXCEPTIONS check has let it through). A word
  // shaped unlike anything above fails loudly rather than guessing.
  if (/[lrsdm]$/.test(lemma)) return lemma + "a";
  throw new Error(`feminineOf("${lemma}"): no rule matched - add it to IRREGULAR_FEMININE`);
}

/** The regular plural of a noun or adjective (masculine or already-feminine form). */
export function pluralOf(lemma: string): string {
  if (IRREGULAR_PLURAL[lemma]) return IRREGULAR_PLURAL[lemma];
  if (/a$/.test(lemma)) {
    const stem = lemma.slice(0, -1);
    if (/c$/.test(stem)) return stem.slice(0, -1) + "ques";
    if (/g$/.test(stem)) return stem.slice(0, -1) + "gues";
    if (/ç$/.test(stem)) return stem.slice(0, -1) + "ces";
    if (/j$/.test(stem)) return stem.slice(0, -1) + "ges";
    return stem + "es";
  }
  if (/[eiou]$/.test(lemma)) return lemma + "s"; // cotxe -> cotxes, gos... no, gos ends in -s, see below
  if (/ç$/.test(lemma)) return lemma.slice(0, -1) + "ços"; // feliç -> feliços
  // A monosyllable ending in -s doubles it (gos -> gossos, pas -> passos);
  // this is the stressed-final-consonant rule levels.json documents. Longer
  // -s/-x/-ig words are the same "stressed final syllable -> -os" rule but
  // stress is not always readable from spelling alone past one syllable, so
  // anything this general case gets wrong belongs in IRREGULAR_PLURAL.
  if (/s$/.test(lemma) && lemma.length <= 4) return lemma + "sos";
  if (/(x|sc|st|xt|ig)$/.test(lemma)) return lemma + "os";
  if (/[àéíóúè]$/.test(lemma) || (lemma.length <= 3 && /[aeiou]$/.test(lemma))) {
    throw new Error(
      `pluralOf("${lemma}"): stressed-vowel plural does not always keep its accent (germans vs béns) - add it to IRREGULAR_PLURAL`,
    );
  }
  return lemma + "s";
}

/** Agree an adjective's lemma (masculine singular citation form) to a gender/number. */
export function agreeAdjective(lemma: string, gender: Gender, number: Number_): string {
  const base = gender === "f" ? feminineOf(lemma) : lemma;
  return number === "pl" ? pluralOf(base) : base;
}

/**
 * `el`/`la`/`els`/`les`, contracted to `l'` before a vowel or `h` - except
 * that `la` does NOT elide before an unstressed i-/u- (la idea, la
 * universitat) though it does before a stressed one (l'illa). Stress is not
 * knowable from spelling alone in general, so this only applies the exception
 * for the closed set of common unstressed-i/u words frames actually use;
 * anything else eliding by the general rule is the right default far more
 * often than not.
 */
const UNSTRESSED_IU_EXCEPTIONS = new Set([
  "idea", "universitat", "humitat", "iogurt", "iaia", "uniforme", "utopia",
]);

export function definiteArticle(nounSurface: string, gender: Gender, number: Number_): string {
  if (number === "pl") return gender === "f" ? "les" : "els";
  const startsWithVowelOrH = /^[aeiouàèéíòóúüh]/i.test(nounSurface);
  if (gender === "f" && startsWithVowelOrH && UNSTRESSED_IU_EXCEPTIONS.has(nounSurface.toLowerCase())) {
    return "la";
  }
  if (startsWithVowelOrH) return "l'";
  return gender === "f" ? "la" : "el";
}

export function indefiniteArticle(gender: Gender, number: Number_): string {
  if (number === "pl") return gender === "f" ? "unes" : "uns";
  return gender === "f" ? "una" : "un";
}

/**
 * `a`/`de`/`per` + the definite article, contracted where Catalan contracts
 * them: al/als, del/dels, pel/pels. `la`/`les` never contract (a la casa, de
 * la casa, per la finestra), and neither does an elided `l'` (a l'aigua).
 */
export function withPreposition(
  prep: "a" | "de" | "per",
  nounSurface: string,
  gender: Gender,
  number: Number_,
): string {
  const article = definiteArticle(nounSurface, gender, number);
  if (article === "el") return `${{ a: "al", de: "del", per: "pel" }[prep]} ${nounSurface}`;
  if (article === "els") return `${{ a: "als", de: "dels", per: "pels" }[prep]} ${nounSurface}`;
  if (article === "l'") return `${prep} l'${nounSurface}`;
  return `${prep} ${article} ${nounSurface}`;
}

/**
 * Present indicative, one person, for the small set of verbs frames actually
 * use. Ten of the twelve most frequent Catalan verbs are irregular in the
 * present (ser, estar, tenir, haver, anar, fer, poder, voler, saber, venir),
 * so "conjugate the regular paradigm" covers almost none of what a beginner
 * text needs to say. Authored directly rather than extracted from
 * `conjugationSurfaces` (which returns every form of the whole paradigm,
 * unlabeled, for index-building) - the same authored-table shape as every
 * other genuinely irregular piece of data in this file.
 */
const IRREGULAR_PRESENT: Record<string, Record<Person, string>> = {
  ser: { "1sg": "soc", "2sg": "ets", "3sg": "és" },
  estar: { "1sg": "estic", "2sg": "estàs", "3sg": "està" },
  tenir: { "1sg": "tinc", "2sg": "tens", "3sg": "té" },
  haver: { "1sg": "he", "2sg": "has", "3sg": "ha" },
  anar: { "1sg": "vaig", "2sg": "vas", "3sg": "va" },
  fer: { "1sg": "faig", "2sg": "fas", "3sg": "fa" },
};

const REGULAR_AR_ENDING: Record<Person, string> = { "1sg": "o", "2sg": "es", "3sg": "a" };

/**
 * Present indicative of a regular first-conjugation (-ar) verb, or an
 * authored irregular. Throws for anything else - second/third-conjugation
 * present tense is more irregular still (incoative -eix-, stem-final
 * consonant changes) and is out of scope until a frame needs it, at which
 * point it gets its own authored or derived rule rather than a silent guess.
 */
export function presentOf(infinitive: string, person: Person): string {
  if (IRREGULAR_PRESENT[infinitive]) return IRREGULAR_PRESENT[infinitive][person];
  if (!/ar$/.test(infinitive)) {
    throw new Error(`presentOf("${infinitive}"): only regular -ar verbs and authored irregulars are covered`);
  }
  return attach(stemOf(infinitive, 1), REGULAR_AR_ENDING[person], 1);
}
