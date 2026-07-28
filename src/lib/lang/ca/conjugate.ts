/**
 * Catalan verb conjugation (Central Catalan, the standard taught to learners).
 *
 * Three conjugations, keyed off the infinitive ending:
 *   1. -ar            parlar   (by far the largest and most regular)
 *   2. -er / -re      perdre, témer, beure
 *   3. -ir            two sub-types that differ only in the present:
 *        pure         dormir  -> dormo, dorms, dorm
 *        incoative    servir  -> serveixo, serveixes, serveix   (the majority)
 *
 * The hard part is not the endings, it is Catalan orthography. A stem's final
 * consonant changes spelling to preserve its sound before a front vowel, and
 * an `i`/`u` after a vowel takes a diaeresis to stay syllabic. Getting these
 * wrong produces plausible-looking words that do not exist - exactly the
 * failure mode that let malformed Dari forms reach learners - so they are
 * applied centrally in `attach()` rather than per-tense.
 */

export type Conjugation = 1 | 2 | 3;

export interface CatalanVerbStems {
  /** Full infinitive, e.g. "parlar", "perdre", "servir". */
  infinitive: string;
  conjugation: Conjugation;
  /** 3rd conjugation only: -eix- present (servir) vs pure (dormir). */
  incoative?: boolean;
  /**
   * Fully irregular surface forms keyed by slot, merged over the generated
   * paradigm. Verbs like ser/anar/fer are suppletive and cannot be derived.
   */
  overrides?: Record<string, string[]>;
}

/** Person-number order used throughout: jo, tu, ell, nosaltres, vosaltres, ells. */
const P6 = 6;

// ---------------------------------------------------------------------------
// Orthography
// ---------------------------------------------------------------------------

const FRONT = /^[eií]/;
const VOWEL = /[aeiouàèéíòóúï]/i;

/**
 * Join a stem to an ending, applying the spelling changes Catalan requires.
 *
 * Before a front vowel (e/i) the stem's final sound must be respelled:
 *   c -> qu   (tocar   -> toquem, toqui)
 *   g -> gu   (pagar   -> paguem, pagui)
 *   ç -> c    (començar-> comencem)
 *   j -> g    (menjar  -> mengem)
 *
 * And an ending that starts with i/u directly after a stem vowel takes a
 * diaeresis so it stays a separate syllable (conduir -> conduïm, agrair ->
 * agraïm) - without it the pair would read as a diphthong.
 */
export function attach(stem: string, ending: string, conjugation: Conjugation = 1): string {
  if (!ending) return stem;
  let s = stem;

  // Consonant respelling is a FIRST-CONJUGATION phenomenon. In -ar verbs the
  // stem consonant sits before a back vowel in the infinitive (pagar, tocar)
  // and must be protected when an -e/-i ending follows. In -er/-ir verbs it
  // already precedes a front vowel, so it must be left alone: llegir keeps its
  // soft g (llegeixo, not *llegueixo) and seguir keeps its digraph.
  if (conjugation === 1 && FRONT.test(ending)) {
    // NOTE: no qu -> qü / gu -> gü rule here. It is right for the handful of
    // verbs whose u is pronounced (adequar -> adeqües) and wrong for the very
    // common ones where `gu`/`qu` is a digraph (seguir -> seguim, seguixi).
    // Which of the two a verb is cannot be derived from spelling, so those few
    // verbs belong in IRREGULAR_VERBS rather than in a rule that corrupts
    // everyday vocabulary.
    if (/c$/.test(s)) s = s.slice(0, -1) + "qu";
    else if (/g$/.test(s)) s = s.slice(0, -1) + "gu";
    else if (/ç$/.test(s)) s = s.slice(0, -1) + "c";
    else if (/j$/.test(s)) s = s.slice(0, -1) + "g";
  }

  // Diaeresis: unstressed i/u opening an ending, straight after a stem vowel.
  if (/^[iu]/.test(ending) && VOWEL.test(s.slice(-1)) && !/[gq]u$/.test(s)) {
    const rest = ending.slice(1);
    // Only when the i/u is not already carrying its own accent.
    if (!/^[íú]/.test(ending)) {
      return s + (ending[0] === "i" ? "ï" : "ü") + rest;
    }
  }
  return s + ending;
}

/**
 * Bare 3rd-person singular of a 2nd-conjugation verb.
 *
 * The ending is empty, so the form is the stem - except that a stem ending in
 * -nd drops its d (prendre -> pren, respondre -> respon, entendre -> entén),
 * because Catalan does not end a word in -nd.
 */
function bare3sg(stem: string): string {
  if (/nd$/.test(stem)) return stem.slice(0, -1);
  // A word cannot end in an obstruent+liquid cluster, so a supporting -e
  // appears: obrir -> obre, omplir -> omple. (dormir -> dorm is fine.)
  if (/[bcdfgpt][rl]$/.test(stem)) return stem + "e";
  return stem;
}

/** Infinitive minus its ending: parlar->parl, perdre->perd, servir->serv. */
export function stemOf(infinitive: string, conjugation: Conjugation): string {
  if (conjugation === 1) return infinitive.replace(/ar$/, "");
  if (conjugation === 3) return infinitive.replace(/ir$/, "");
  return infinitive.replace(/(re|er)$/, "");
}

/** Future/conditional build on the infinitive, with -re verbs dropping the e. */
function futureStem(v: CatalanVerbStems): string {
  if (v.conjugation === 2 && /re$/.test(v.infinitive)) return v.infinitive.slice(0, -1);
  return v.infinitive;
}

// ---------------------------------------------------------------------------
// Endings
// ---------------------------------------------------------------------------

const PRESENT: Record<Conjugation, string[]> = {
  1: ["o", "es", "a", "em", "eu", "en"],
  2: ["o", "s", "", "em", "eu", "en"],
  3: ["o", "s", "", "im", "iu", "en"],
};

/** Incoative present inserts -eix- in the singular and 3rd plural. */
const PRESENT_INCOATIVE = ["eixo", "eixes", "eix", "im", "iu", "eixen"];

const PRESENT_SUBJ: Record<Conjugation, string[]> = {
  1: ["i", "is", "i", "em", "eu", "in"],
  2: ["i", "is", "i", "em", "eu", "in"],
  3: ["i", "is", "i", "im", "iu", "in"],
};
const PRESENT_SUBJ_INCOATIVE = ["eixi", "eixis", "eixi", "im", "iu", "eixin"];

/** -ar keeps an -av- imperfect; the other two use -i-. */
const IMPERFECT: Record<Conjugation, string[]> = {
  1: ["ava", "aves", "ava", "àvem", "àveu", "aven"],
  2: ["ia", "ies", "ia", "íem", "íeu", "ien"],
  3: ["ia", "ies", "ia", "íem", "íeu", "ien"],
};

const FUTURE = ["é", "às", "à", "em", "eu", "an"];
const CONDITIONAL = ["ia", "ies", "ia", "íem", "íeu", "ien"];

const IMPERFECT_SUBJ: Record<Conjugation, string[]> = {
  1: ["és", "essis", "és", "éssim", "éssiu", "essin"],
  2: ["és", "essis", "és", "éssim", "éssiu", "essin"],
  3: ["ís", "issis", "ís", "íssim", "íssiu", "issin"],
};

const PARTICIPLE: Record<Conjugation, string[]> = {
  1: ["at", "ada", "ats", "ades"],
  2: ["ut", "uda", "uts", "udes"],
  3: ["it", "ida", "its", "ides"],
};

const GERUND: Record<Conjugation, string> = { 1: "ant", 2: "ent", 3: "int" };

// ---------------------------------------------------------------------------
// Paradigm
// ---------------------------------------------------------------------------

/**
 * Every single-token surface form of the paradigm.
 *
 * Multi-token constructions need no handling because each of their tokens is
 * already covered: the periphrastic past (`vaig parlar`) is `anar` + the
 * infinitive, and the perfect (`he parlat`) is `haver` + the participle.
 */
export function conjugationSurfaces(v: CatalanVerbStems): string[] {
  const stem = stemOf(v.infinitive, v.conjugation);
  const fut = futureStem(v);
  const incoative = v.conjugation === 3 && v.incoative;
  const present = incoative ? PRESENT_INCOATIVE : PRESENT[v.conjugation];
  const subj = incoative ? PRESENT_SUBJ_INCOATIVE : PRESENT_SUBJ[v.conjugation];

  /**
   * An override *replaces* its slot rather than adding to it. This matters:
   * `ser` and `anar` are suppletive, so generating the regular paradigm
   * alongside would inject non-words (`sero`, `anaré`-style stems) into the
   * lexicon index and let the AI emit them as valid Catalan - the same class of
   * defect that malformed Dari verb forms turned out to be.
   */
  const slot = (name: string, generate: () => string[]): string[] =>
    v.overrides?.[name] ?? generate();

  const out: string[] = [
    v.infinitive,
    ...slot("gerund", () => [attach(stem, GERUND[v.conjugation], v.conjugation)]),
    ...slot("present", () =>
      present.map((e) => (e === "" ? bare3sg(stem) : attach(stem, e, v.conjugation))),
    ),
    ...slot("presentSubjunctive", () => subj.map((e) => attach(stem, e, v.conjugation))),
    ...slot("imperfect", () => IMPERFECT[v.conjugation].map((e) => attach(stem, e, v.conjugation))),
    ...slot("imperfectSubjunctive", () =>
      IMPERFECT_SUBJ[v.conjugation].map((e) => attach(stem, e, v.conjugation)),
    ),
    ...slot("future", () => FUTURE.map((e) => fut + e)),
    ...slot("conditional", () => CONDITIONAL.map((e) => fut + e)),
    ...slot("participle", () => PARTICIPLE[v.conjugation].map((e) => attach(stem, e, v.conjugation))),
    // Imperative: 2sg is the bare stem + -a for -ar and the 3sg present
    // otherwise; the remaining persons borrow the subjunctive.
    ...slot("imperative", () => [
      v.conjugation === 1 ? attach(stem, "a", 1) : bare3sg(stem),
      attach(stem, subj[2], v.conjugation),
      attach(stem, subj[3], v.conjugation),
      attach(stem, present[4], v.conjugation),
      attach(stem, subj[5], v.conjugation),
    ]),
  ];

  return out.filter((f, i, a) => f && a.indexOf(f) === i);
}

/** Slots an irregular table may override, for documentation and typo safety. */
export const SLOTS = [
  "present", "presentSubjunctive", "imperfect", "imperfectSubjunctive",
  "future", "conditional", "participle", "gerund", "imperative",
] as const;

export { P6 };
