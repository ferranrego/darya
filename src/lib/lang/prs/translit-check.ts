/**
 * Detect a Dari transliteration that was actually written in Iranian Persian.
 *
 * PEDAGOGY §9: Iranian forms taught as Dari is the defect this product cares
 * most about, and the app ships no audio - so the Latin line is the only
 * pronunciation a learner ever gets. The tell is not a word from a blocklist;
 * it is a whole sentence written the wrong way, with every long ā and every
 * majhul ē/ō flattened out: `Anjam va ghayat-e ensan residan be kamal-e
 * motlaq ast` for `anjām wa ghāyat-i insān rasēdan ba kamāl-i mutlaq ast`.
 *
 * The first version of this check only asked whether the Latin contained a
 * long vowel. That is nearly right and wrong in a way worth keeping: some
 * perfectly correct Dari sentences contain no long vowel at all - `mardum az
 * sitam khasta shuda-and` is entirely short vowels - so the rule quietly
 * called correct content defective and hid it from learners. Measured on the
 * real lexicon it did that to 3 entries while catching 1,208.
 *
 * So the question is asked against the script instead, which is what actually
 * carries the evidence: Perso-Arabic does not write short vowels, but it does
 * write the long ones as ا, و and ی. If the script shows two or more of those
 * and the transliteration shows none, the vowels were dropped in translation.
 * If the script shows none either, the sentence really is all short vowels and
 * there is nothing wrong with it.
 *
 * Two deliberate imprecisions, both erring the safe way:
 *
 *  - A word-initial ا is a short-vowel carrier (`az`, `ast`, `īn`), not a
 *    long vowel, so it is stripped before counting.
 *  - The threshold is two, not one, because a single ی is usually `yak` or a
 *    consonantal y. That leaves the occasional single-long-vowel sentence
 *    (`būdand`) uncaught, which is the right way round to be wrong: a missed
 *    entry stays on the repair list, whereas a false positive hides correct
 *    Dari from a learner who needed it.
 *
 * `VERIFIED_SHORT_VOWEL` is the last resort for what remains. ی is counted
 * because dropping it costs 21 real detections, but ی also spells the
 * diphthong in `bayn` and `tarafayn`, where no long vowel is missing and none
 * should appear. Those sentences cannot be told apart from the script alone,
 * so they are named. Add an id only after reading the entry and confirming the
 * transliteration is right; it is an assertion about that entry, not a way to
 * quiet the rule. Note it exempts the whole entry, headword and example alike,
 * so check both before adding one.
 */

/** Correct Dari that happens to contain no long vowel at all. Verified by hand. */
export const VERIFIED_SHORT_VOWEL: ReadonlySet<string> = new Set([
  // عقد بیع بین طرفین منعقد شد - aqd-i bay' bayn-i tarafayn mun'aqid shud.
  // Three ی, every one of them a diphthong or a consonant.
  "lx-4197",
  // ابرنواختر نوع اول - abar-naw-akhtar-i naw'-i awwal. Same story with و:
  // `naw`, `naw'` and the doubled w of `awwal`, no long vowel anywhere.
  "lx-5054",
]);

/** Below this a string is too short for the absence of a long vowel to mean anything. */
const MIN_LENGTH = 25;

/** How many written long vowels the script must show before their absence is evidence. */
const MIN_SCRIPT_LONG_VOWELS = 2;

const ZWNJ = /‌/g;

/** Long vowels as the Perso-Arabic script writes them, ignoring carrier alef. */
export function scriptLongVowelCount(target: string): number {
  let n = 0;
  for (const word of target.replace(ZWNJ, " ").split(/\s+/)) {
    if (!word) continue;
    n += (word.replace(/^[اآ]/, "").match(/[اويیآ]/g) ?? []).length;
  }
  return n;
}

/**
 * After a vowel the Dari ezafe is spelled `-ye`, never a bare `-e`:
 * `naqsha-ye kābul`, not `naqsha-e kābul`. After a consonant it is `-e`.
 *
 * The seed texts and the grammar course always got this right; the lexicon
 * carried 480 of the wrong form, inherited from an older `-i` spelling that a
 * normalisation pass renamed rather than corrected. Safe to check
 * mechanically because the hyphen means an ezafe has already been written as
 * one, and the indefinite marker is spelled `-ē`, which never precedes it.
 */
export function bareEzafeAfterVowel(translit: string | undefined): string | null {
  if (!translit) return null;
  const m = translit.match(/[aāēīōū]-e(?=[\s.,?!:;)]|$)/);
  return m ? m[0] : null;
}

/**
 * A word ending in a bare short `-i`: `hasti`, `mērawi`, `rafti`.
 *
 * The 2sg verb ending is written ی, a long vowel, and the app writes it `-ī`
 * everywhere a learner meets it - the lexicon, `spoken.ts`, the Grammar Hub,
 * and gl-13's own grammarPointEn. The grammar course's tables and exercises
 * said `-i` in about 200 places anyway, so the same lesson taught `hastī` in
 * its summary and `hasti` in its table (167 tokens in all). A Dari philologist
 * found it; nothing mechanical could, because every one of those forms is a
 * real word.
 *
 * Checked only where the convention already holds (the grammar course and the
 * hub), never the lexicon: the lexicon still carries ~500 bare `-i` tokens,
 * most of them -ī adjectives (`farhangi`, `dawlati`) from an older
 * transcription, and pointing this at it would bury the signal. Capitalised
 * tokens are skipped because a name is spelled however its owner spells it.
 * Measured when it shipped: 138 course transliteration fields failed before
 * the repair, 0 after; the hub was already at 0. The only lowercase-looking
 * -i words left in the course are `Dari`, `Ali` and `Kabuli`, all capitalised
 * and all in English prose, which this is never run on.
 *
 * The first version said "no Dari word ends in a short i", which is true
 * except for exactly one family: که is `ki` app-wide (philologist ruling -
 * Dari [kʰɪ], Tajik ки; `ke` is the Iranian reading), and so are the words
 * built on it and on چه. The rule fired on every one of them the moment the
 * hub adopted `ki` (40 hub fields: 37 `ki`, 3 `agarchi`), and blamed "the
 * 2sg ending" for it. With them exempt, the 40 hub pages and the course, now
 * 209 `ki`, pass with no other exception. Those particles are
 * named below rather than loosening the pattern, because a 2sg verb can end
 * in any consonant + i and no shape separates it from `balki`.
 */
export const SHORT_I_PARTICLES: ReadonlySet<string> = new Set([
  "ki",
  "chi",
  "balki",
  "chunki",
  "chūnki",
  "īnki",
  "agarchi",
  "garchi",
  "chunānki",
  "hamchunānki",
]);

export function bareShortIEnding(translit: string | undefined): string | null {
  if (!translit) return null;
  // \p{M} in the lookahead: a decomposed ī (i + U+0304) is a long vowel, not
  // a bare i followed by a non-letter.
  for (const m of translit.matchAll(/(?<![\p{L}\p{M}'’])[a-zāēīōū'’-]*[a-zāēīōū'’]i(?![\p{L}\p{M}'’])/gu)) {
    // `waqtē-ki` style hyphen compounds end in the particle, so judge the last part.
    const last = m[0].split("-").pop() ?? m[0];
    if (SHORT_I_PARTICLES.has(m[0]) || SHORT_I_PARTICLES.has(last)) continue;
    return m[0];
  }
  return null;
}

/** True when `translit` dropped the long vowels its own script spells out. */
export function isFlattenedTranslit(
  translit: string | undefined,
  target: string,
  id?: string,
): boolean {
  if (!translit || translit.length <= MIN_LENGTH) return false;
  if (/[āēōīū]/.test(translit)) return false;
  if (id && VERIFIED_SHORT_VOWEL.has(id)) return false;
  return scriptLongVowelCount(target) >= MIN_SCRIPT_LONG_VOWELS;
}
