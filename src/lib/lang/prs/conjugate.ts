import { ZWNJ } from "./normalize.ts";

/**
 * Deterministic Dari/Persian verb conjugation.
 *
 * Persian conjugation is regular given two stems: the past stem (infinitive
 * minus the final ن of its دن/تن ending - derivable) and the present stem
 * (suppletive - supplied per-entry via `presentStem` or VERB_OVERRIDES).
 * `conjugationSurfaces` expands a stem pair into every single-token surface
 * form of the standard paradigm; multi-token constructions (future خواهم کرد,
 * pluperfect کرده بودم, progressive داشتم می‌رفتم, passive کرده می‌شود) need no
 * handling because each of their tokens is already covered individually.
 *
 * The output is display-agnostic: forms with می/نمی or perfect enclitics are
 * emitted in both ZWNJ and ZWNJ-joined spellings, since real text uses both
 * (می‌کنم and میکنم). Callers are expected to pass each surface through
 * `matchKey` before using it as a lookup key.
 */

export interface VerbStems {
  /** Past stem WITHOUT any separable prefix: گشت for برگشتن. */
  pastStem: string;
  /** Present stem WITHOUT prefix (کن، رو، گرد); null = past system only. */
  presentStem: string | null;
  /** Separable prefix (بر، در…): برمی‌گردم، برنگشتم؛ subjunctive برگردم without ب. */
  prefix?: string;
  /** داشتن: present is bare دارم/ندارم, never می‌دارم; no ب subjunctive/imperative. */
  noMiPresent?: boolean;
}

/** Past stem from an infinitive: کردن → کرد. Null unless it ends in دن/تن. */
export function derivePastStem(infinitive: string): string | null {
  return /(دن|تن)$/.test(infinitive) ? infinitive.slice(0, -1) : null;
}

const PAST_ENDINGS = ["م", "ی", "", "یم", "ید", "ند"];
const PRESENT_ENDINGS = ["م", "ی", "د", "یم", "ید", "ند"];
const PERFECT_ENCLITICS = ["ام", "ای", "ایم", "اید", "اند"];

/**
 * Present stems that take an epenthetic ی before vowel-initial endings.
 * All ا/آ-final stems do (نما → نمایم); و-final stems are lexical - گو/جو
 * (gō/jō → گویم) do, رو/شو/دو (raw/shaw/daw → روم) do not.
 */
const Y_EPENTHESIS_STEMS = new Set(["گو", "جو"]);

/**
 * Exported so `surface.ts` applies the identical rule when it builds a
 * single present-tense form for the authoring brief - the two must not
 * disagree about which stems take the glide (see this file's own header).
 */
export function takesEpenthesis(stem: string): boolean {
  return /[اآ]$/.test(stem) || Y_EPENTHESIS_STEMS.has(stem);
}

/**
 * Transliteration of a separable prefix (برمی‌گردد، فرومی‌پاشد), keyed the
 * same way as `VERB_OVERRIDES`' own `prefix` field. Kept beside it rather
 * than inferred, because a prefix's script and its reading do not share
 * enough letters to derive one from the other (بر is "bar", not a
 * transliteration of the letters ب+ر in isolation).
 */
export const PREFIX_TRANSLIT: Record<string, string> = {
  بر: "bar",
  فرو: "furō",
};

/** Attach the subjunctive/imperative ب: ب+کن→بکن، ب+آ→بیا، ب+افت→بیفت. */
function joinB(stem: string): string {
  if (stem.startsWith("آ")) return "بیا" + stem.slice(1);
  if (stem.startsWith("ا")) return "بی" + stem.slice(1);
  return "ب" + stem;
}

/** Attach the negative ن: ن+رفت→نرفت، ن+آمد→نیامد، ن+افتاد→نیفتاد. */
function joinNeg(stem: string): string {
  if (stem.startsWith("آ")) return "نیا" + stem.slice(1);
  if (stem.startsWith("ا")) return "نی" + stem.slice(1);
  return "ن" + stem;
}

/** می‌X and میX spellings (and نمی‌X / نمیX with negative=true). */
function miForms(core: string, negative: boolean): string[] {
  const mi = negative ? "نمی" : "می";
  return [mi + ZWNJ + core, mi + core];
}

/** All single-token surface forms of the paradigm. May contain duplicates. */
export function conjugationSurfaces(stems: VerbStems): string[] {
  const p = stems.prefix ?? "";
  const past = stems.pastStem;
  const out: string[] = [];

  // Past system: simple past, negative past, imperfect (می), negative imperfect.
  for (const e of PAST_ENDINGS) {
    out.push(p + past + e);
    out.push(p + joinNeg(past) + e);
    for (const m of miForms(past + e, false)) out.push(p + m);
    for (const m of miForms(past + e, true)) out.push(p + m);
  }

  // Perfect system: participle کرده, perfect کرده‌ام…, negatives نکرده‌ام….
  const participle = past + "ه";
  const negParticiple = joinNeg(past) + "ه";
  out.push(p + participle, p + negParticiple);
  for (const enc of PERFECT_ENCLITICS) {
    out.push(p + participle + ZWNJ + enc, p + participle + enc);
    out.push(p + negParticiple + ZWNJ + enc, p + negParticiple + enc);
  }

  // Present system.
  const s = stems.presentStem;
  if (s) {
    const base = takesEpenthesis(s) ? s + "ی" : s;
    for (const e of PRESENT_ENDINGS) {
      if (stems.noMiPresent) {
        // داشتن: دارم / ندارم only.
        out.push(base + e, joinNeg(base) + e);
        continue;
      }
      // Indicative می‌کنم / نمی‌کنم.
      for (const m of miForms(base + e, false)) out.push(p + m);
      for (const m of miForms(base + e, true)) out.push(p + m);
      // Subjunctive بکنم (prefix verbs drop ب: برگردم) and bare کنم;
      // negative نکنم serves both.
      const bStem = p ? p + s : joinB(s);
      out.push(bStem + (takesEpenthesis(s) ? "ی" : "") + e);
      out.push(p + base + e);
      out.push(p + joinNeg(base) + e);
    }
    if (!stems.noMiPresent) {
      // Imperative بکن/بکنید (برگرد for prefix verbs), negative نکن/نکنید.
      const impStem = p ? p + s : joinB(s);
      const impPl = (takesEpenthesis(s) || /[اآ]$/.test(impStem) ? "ی" : "") + "ید";
      out.push(impStem, impStem + impPl);
      out.push(p + joinNeg(s), p + joinNeg(s) + (takesEpenthesis(s) ? "ی" : "") + "ید");
    }
  }

  return out;
}

/**
 * Present stems (and irregular flags) for core verbs, keyed by matchKey of the
 * infinitive. These take precedence over `presentStem` in the lexicon data and
 * over regex extraction in the enrichment script. `skip: true` blocks present
 * generation entirely (بودن is suppletive - هست/است live in authored variants).
 *
 * `presentStemTranslit` takes the same precedence, and for the same reason:
 * a compound verb's own lexicon entry (دوست داشتن, بیدار شدن) authors its own
 * copy of the light verb's stem translit, and that copy can drift from the
 * light verb's own headword entry - بیدار شدن had "shō" where شدن's own
 * entry has "shaw", which surfaced as mēshōad instead of mēshawad. Sourcing
 * it from here instead, the same way the script stem already is, means every
 * compound built on a given light verb reads identically regardless of what
 * its own entry happens to say.
 */
export const VERB_OVERRIDES: Record<
  string,
  Partial<VerbStems> & { skip?: boolean; presentStemTranslit?: string }
> = {
  [k("کردن")]: { presentStem: "کن", presentStemTranslit: "kun" },
  [k("رفتن")]: { presentStem: "رو", presentStemTranslit: "raw" },
  [k("گفتن")]: { presentStem: "گو", presentStemTranslit: "gō" },
  [k("دیدن")]: { presentStem: "بین", presentStemTranslit: "bīn" },
  [k("آمدن")]: { presentStem: "آ", presentStemTranslit: "ā" },
  [k("دادن")]: { presentStem: "ده", presentStemTranslit: "dih" },
  [k("گرفتن")]: { presentStem: "گیر", presentStemTranslit: "gīr" },
  [k("خواستن")]: { presentStem: "خواه", presentStemTranslit: "khāh" },
  [k("توانستن")]: { presentStem: "توان", presentStemTranslit: "tawān" },
  [k("زدن")]: { presentStem: "زن", presentStemTranslit: "zan" },
  [k("خوردن")]: { presentStem: "خور", presentStemTranslit: "khur" },
  [k("شدن")]: { presentStem: "شو", presentStemTranslit: "shaw" },
  [k("آوردن")]: { presentStem: "آور", presentStemTranslit: "āwar" },
  [k("گذاشتن")]: { presentStem: "گذار", presentStemTranslit: "guzār" },
  [k("نشستن")]: { presentStem: "نشین", presentStemTranslit: "nishīn" },
  [k("ساختن")]: { presentStem: "ساز", presentStemTranslit: "sāz" },
  [k("فروختن")]: { presentStem: "فروش", presentStemTranslit: "furōsh" },
  [k("ریختن")]: { presentStem: "ریز", presentStemTranslit: "rēz" },
  [k("یافتن")]: { presentStem: "یاب", presentStemTranslit: "yāb" },
  [k("دانستن")]: { presentStem: "دان", presentStemTranslit: "dān" },
  [k("خواندن")]: { presentStem: "خوان", presentStemTranslit: "khān" },
  [k("نوشتن")]: { presentStem: "نویس", presentStemTranslit: "nawīs" },
  [k("شنیدن")]: { presentStem: "شنو", presentStemTranslit: "shunaw" },
  [k("گشتن")]: { presentStem: "گرد", presentStemTranslit: "gard" },
  [k("کشیدن")]: { presentStem: "کش", presentStemTranslit: "kash" },
  [k("راندن")]: { presentStem: "ران", presentStemTranslit: "rān" },
  [k("چیدن")]: { presentStem: "چین", presentStemTranslit: "chīn" },
  [k("انگاشتن")]: { presentStem: "انگار", presentStemTranslit: "angār" },
  [k("ورزیدن")]: { presentStem: "ورز", presentStemTranslit: "warz" },
  [k("داشتن")]: { presentStem: "دار", noMiPresent: true, presentStemTranslit: "dār" },
  [k("برداشتن")]: { presentStem: "دار", prefix: "بر", presentStemTranslit: "dār" },
  [k("برگشتن")]: { presentStem: "گرد", prefix: "بر", presentStemTranslit: "gard" },
  [k("برخاستن")]: { presentStem: "خیز", prefix: "بر", presentStemTranslit: "khēz" },
  [k("برانگیختن")]: { presentStem: "انگیز", prefix: "بر", presentStemTranslit: "angēz" },
  [k("فروپاشیدن")]: { presentStem: "پاش", prefix: "فرو", presentStemTranslit: "pāsh" },
  [k("بودن")]: { skip: true },
};

/** Local matchKey clone to avoid importing it at module-eval time in tests. */
function k(infinitive: string): string {
  return infinitive.replace(/[آأإ]/g, "ا");
}
