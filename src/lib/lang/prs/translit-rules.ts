/**
 * The transliteration conventions, as a check both the gate and the runtime
 * can run.
 *
 * These rules already existed, in `checkDariTranslit` inside
 * `scripts/validate-content.ts`, where only authored content could reach them.
 * Generated content was therefore held to a different standard than authored
 * content - and not by a decision, just by which file the rules happened to
 * live in. Measured before this moved: 0 problems across 2,811 transliterated
 * units of authored seed text, against 26 of 53 model-written context
 * sentences, every one of them generated with these same rules in its prompt.
 * A prompt asks; only a check decides.
 *
 * The rules here are the ones that need nothing but the string and its Dari.
 * The two that need the lexicon's verb stems (`verb1plIm`, `nonBuPrefix`) stay
 * in the gate: reaching them from the runtime would mean importing the lexicon
 * into the AI path, and `scripts/check-bundle.ts` confines the lexicon to six
 * routes on purpose.
 */
import {
  bareEzafeAfterVowel,
  bareShortIEnding,
  cheAsWord,
  isFlattenedTranslit,
  shortEVowel,
} from "./translit-check.ts";

/**
 * A word boundary that understands ā, ē, ī, ō, ū.
 *
 * JavaScript's `\b` is ASCII-only, so in `rassāmī-ye` it finds a boundary
 * between the ā and the m and reports a verb prefix in the middle of a noun
 * plus its ezafe. The gate's own `/\bmi-/` never hit this because it does not
 * match the macron; widening it to cover `mī-` made the flaw reachable, and it
 * fired on real lexicon entries the moment it was run against them.
 */
const START = "(?<![\\p{L}\\p{M}])";

/**
 * Dashes and joiners a model reaches for in place of an ASCII hyphen.
 *
 * Not cosmetic. `mī‌-rom` carries a ZWNJ between the ī and the hyphen, and
 * `mī‐rom` a U+2010, so `/\bmi-/` - the gate's own prefix test - matched
 * neither. 14 of the 25 prefix errors in the cache were invisible for this
 * reason alone. Normalize first, then test.
 */
const EXOTIC_DASH = /[‐‑‒–—‌‍]/g;

/** The ASCII-hyphen form of a transliteration, for matching against. */
export function normalizeTranslitDashes(translit: string): string {
  return translit.replace(EXOTIC_DASH, "-").replace(/-{2,}/g, "-");
}

/** A rule's stable name, so a caller can decide how loudly to react to it. */
export type TranslitRule =
  | "me-prefix"
  | "kh-not-x"
  | "sher"
  | "dost"
  | "ezafe"
  | "short-e"
  | "chi"
  | "final-yeh"
  | "flattened"
  | "ascii-dash";

export interface TranslitProblem {
  rule: TranslitRule;
  message: string;
}

/**
 * Every convention `translit` breaks. Empty means it is acceptable.
 *
 * Severity is the caller's, not this function's, and the two callers really do
 * differ: generated content is rejected on any of these, while the gate warns
 * on `kh-not-x` and `ascii-dash` because 60 authored entries predate those
 * checks and a red gate nobody can make green is a gate people stop reading.
 *
 * `target` is the Dari the transliteration is of. Without it the flattening
 * check cannot run - whether a missing long vowel is wrong depends on whether
 * the script spells one - so callers should pass it whenever they have it.
 */
export function translitProblems(
  translit: string,
  target?: string,
  opts: { finalYeh?: boolean; id?: string } = {},
): TranslitProblem[] {
  const t = normalizeTranslitDashes(translit).normalize("NFC");
  const out: TranslitProblem[] = [];
  const add = (rule: TranslitRule, message: string) => out.push({ rule, message });

  if (new RegExp(`${START}m[iī]-`, "iu").test(t)) add("me-prefix", "present prefix must be mē-, not mi-/mī-");
  // The orthography block asks for European-friendly digraphs in every field;
  // an x is always خ spelled the academic way.
  if (/x/i.test(t)) add("kh-not-x", "uses x for خ - it is kh (khordan, not xordan)");
  if (new RegExp(`${START}shir(?![\\p{L}\\p{M}])`, "iu").test(t)) add("sher", "must use the majhul ē: shēr, not shir");
  if (new RegExp(`${START}dust`, "iu").test(t)) add("dost", "must use the majhul ō: dōst, not dust");

  const ezafe = bareEzafeAfterVowel(t);
  if (ezafe) add("ezafe", `writes the ezafe as "${ezafe}" - after a vowel it is -ye`);

  const shortE = shortEVowel(t);
  if (shortE) add("short-e", `writes "${shortE}" with a short e - the kasra is i (kitāb, not ketāb)`);

  const che = cheAsWord(t);
  if (che) add("chi", `writes چه as "${che}" - it is chi`);

  /**
   * Opt-in, because the gate applies it to grammar-hub content only. Run
   * against the lexicon it reports hundreds of entries (`khayli`, `khāli`,
   * `asabāni`) that have been reviewed and shipped, so switching it on
   * everywhere would not be a stricter check - it would be a false alarm
   * large enough to train everyone to ignore the output.
   */
  if (opts.finalYeh) {
    const bareI = bareShortIEnding(t);
    if (bareI) add("final-yeh", `"${bareI}" ends in a short -i - a final ی is -ī or -ē`);
  }

  // `id` carries the VERIFIED_SHORT_VOWEL exemptions - entries a reviewer has
  // confirmed really do have no long vowel. Omitting it reports them as
  // flattened, which is how this check first appeared to find three faults in
  // content that had already been reviewed.
  if (target && isFlattenedTranslit(t, target, opts.id)) {
    add("flattened", "no long or majhul vowel anywhere - Iranian-flattened");
  }

  if (translit !== normalizeTranslitDashes(translit)) {
    add("ascii-dash", "contains a non-ASCII dash or ZWNJ - the Latin uses a plain hyphen");
  }

  return out;
}
