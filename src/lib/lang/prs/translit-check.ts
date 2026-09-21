/**
 * Detect a Dari transliteration that was actually written in Iranian Persian.
 *
 * THE CONVENTION these checks enforce (owner's decisions on the philologist's
 * advice, applied app-wide by `scripts/normalise-dari-spelling.ts`, and
 * tabulated in `content/prs/lexicon/README.md`):
 *
 *  - The short kasra is `i`: Dari has three short vowels, a / i / u, so
 *    `kitāb`, `bisyār`, `mu'allim`, never `ketāb`. Majhul `ē`/`ō` are
 *    different vowels and keep their macrons (`dōst`, `nēst`, `sē`, `mē-`).
 *  - The ezafe is the exception: it stays `-e` / `-ye` as its own hyphen
 *    segment (`kitāb-e man`, `khāna-ye mā`), see `bareEzafeAfterVowel`.
 *  - چه is `chi` (`chirā`, `chitōr`); spoken چی is `chī`. که is `ki`.
 *  - The 1pl verb ending is majhul `-ēm` (`mērawēm`, `hastēm`), see
 *    `verb1plIm`; nouns in -īm (`taqsīm`) are untouched.
 *  - The subjunctive/imperative prefix is `bu-` (`bubīn`, `budih`; `biyā`).
 *  - The 2sg verb ending is `-ī` (`hastī`), see `bareShortIEnding`.
 *  - خوب is `khūb`; خوا- is `khā` (`mēkhāham`).
 *
 * Loanwords with a real e sound and foreign names are exempt from the i rule
 * by name, in `SHORT_E_LOANWORDS`.
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

// --- The spelling convention: i, chi, -ēm ------------------------------------

/**
 * A Latin word as the transliteration writes it: letters (with a decomposed
 * macron allowed), apostrophes for ع/ء, and internal hyphens for the ezafe,
 * plurals and compounds. Shared with `scripts/normalise-dari-spelling.ts`, so
 * the sweep and this check can never disagree about what a word is.
 */
export const LATIN_WORD =
  /(?<![\p{L}\p{M}'’ʼ])[\p{Script=Latin}'’ʼ][\p{Script=Latin}\p{M}'’ʼ]*(?:-[\p{Script=Latin}'’ʼ][\p{Script=Latin}\p{M}'’ʼ]*)*/gu;

/** The ezafe is a hyphen segment of its own: `kitāb-e`, `khāna-ye`. */
export function isEzafeSegment(segment: string, index: number): boolean {
  return index > 0 && (segment === "e" || segment === "ye");
}

/**
 * Words whose unmarked `e` is not a Dari short kasra, so the i rule does not
 * apply. Two kinds, both verified by reading the entry:
 *
 *  - European loanwords that keep a real e sound in Kabul speech - `model`,
 *    `hotel`, `internet`, `mekānīk`, the `-lōzhī` sciences. Nobody says
 *    `hotil`. Note the app's own everyday loan `tēlifōn` already writes the
 *    sound as majhul ē, which is the better long-term spelling; these are
 *    left as they are rather than guessed at.
 *  - Foreign proper names: `tehrān`, `hāyzenberg`, `dānte`.
 *
 * Matched per hyphen segment. An entry of four or more letters may add `-hā`
 * or `-ī` (`model-hā`, `internetī`); a shorter one matches only whole, so
 * `tez` (thesis) cannot hide a flattened تیزی.
 *
 * One spelling per loanword. The list once held `sistem` and `sīstem`,
 * `telefōn` beside the band-2 `tēlifōn`, `restorān` and `resturān` - an
 * exemption per variant is how variants survive. Where the lexicon already
 * teaches a spelling at a low band the sweep converges on it
 * (`LOANWORD_SPELLINGS` in the script: tēlifōn, sīstim, sigrit, mitr) and the
 * losing forms are not listed here, so the validator catches them coming back.
 *
 * The prothetic vowel before s + consonant is written `i`, as in `istres`:
 * `istāndārd`, `iskan`, `isklerōz`, `ispūtnīk`.
 *
 * Names of places and people outside Afghanistan keep their own spelling
 * (`tehrān`); Afghan names take the i rule like any other Dari word
 * (`hirāt`, `afghānistān`, `misr`).
 */
export const SHORT_E_LOANWORDS: ReadonlySet<string> = new Set([
  // everyday and technical loans
  "model", "modern", "hotel", "motel", "metro", "metrō", "metra", "ālel", "pāndemī", "kōlerā",
  "operā", "kriket", "restorān", "general", "integral", "integrāl", "personel",
  "klaster", "internet", "enterenat", "token", "test", "web", "serwer", "serwis", "serwō",
  "sistemātīk", "isklerōz", "istres", "modernīta", "modernīsm", "ādres", "rekord",
  "rezerv", "rizerw", "kongera", "gālerī", "hāstel", "beton",
  "jet", "chek", "telepōrt", "pārlemān", "fedrāl", "fedrātīw", "nektāyī",
  "kodeks", "komedi", "kumedyān", "grotesk", "tez", "santez", "sintez", "wektor", "tensor",
  "regresyon", "regresiyōn", "potansiyel", "potānsiyel", "difrānsiyel", "pārāmetr",
  "hāyparpārāmetr", "frekāns", "rezūnāns", "pārsek", "bālestīk", "metrīk", "shātel",
  "māykrōserwis", "grānded", "emprātōrī", "imperiyālīzm", "obzheh", "ate'ism", "diyalektīk",
  "enerzhī", "enerzhi", "inerzhī", "oksīzhen", "demokrāsī", "demokrātīk", "demōgrāfī",
  "mekānīk", "mekānīkī", "mekānēk", "mekānīsm", "mekānism", "mekānīkāl", "metāfīzīk",
  "metāzhenōmīk", "metodolōzhī", "epistemolōzhī", "teknīk", "teknolōzhī", "teknolōzhīk",
  "teknālōzhī", "tekanōlōzhī", "zhē'ōteknīk", "termōdīnāmīk", "hermenōtīk", "sībernetīk",
  "elektrīkī", "elektronīk", "elektronīkī", "elektrōnīkī", "elektrūn", "elektron",
  "elektrū", "elektrō", "elektrūdīnāmīk", "elektrōmaghnātēsī", "femīnīzm", "līberālīzm",
  "sekulārīzm", "terōr", "terōrīzm", "terōrist", "terorist", "re'ālīsm", "re'ālīzm",
  "re'ālism", "sūrre'ālīsm", "te'ōrī", "teyorī", "te'ātr", "fenomen", "fenōmen", "nōmenōn",
  "mezūn", "fermīyūn", "leptūn", "entropī", "entrūpī", "gelū'ūn",
  // life sciences
  "zhen", "zhenetīk", "zhenetīkī", "zhenōm", "zhenōmīk", "zhenōtīp", "genom", "fenōtīp",
  "serō", "serolōzhī", "hemātolōzhī", "nefrolōzhī", "endokrinolōzhī", "endokrinolōzhist",
  "dermātolōzhī", "dermātolōzhist", "epīdemiyolōzhī", "epīdemiyolōzhīk", "epīdemiyolōzhist",
  "hepātīt", "herpes", "hetrōzīgōt", "zheriyātrīk", "pediyātrīk", "sāntrōmer", "nēwrōzhenez",
  "fārmākōzhenōmīk", "sāytōmegālōwērūs", "ādenōwērūs", "retrōwērūs", "enwelōp", "egzon",
  "egzōn", "egzom", "egzōm", "endemik", "endemīk", "endemi", "endemī", "terāpōtīk",
  "pātōzhen", "pātōzhenez", "menenjit", "meninzhīt", "telomer", "telōmer", "krisper",
  "diyābet", "demans", "demāns", "epī", "molekūl",
  // Loans whose short o is theirs, not a zamma: the Dari writes no و for it,
  // so the short-o rule would otherwise nativise them (kārbun, kud).
  "kārbon", "kod",
  // کر is the choir (chorus), not کر "deaf": a loan whose short o is its own.
  // The two are homographs in the script, which is how a repair pass matching
  // on the Dari alone turned the choir into the deaf man.
  "kor",
  "māyelōpātī", "wīremī", "biyōmetrīk", "rezhīm",
  // spelled-out initialisms: dī-en-ē, ār-en-ē, jī-pī-es, em-ār-āy
  "en", "es", "em",
  // foreign proper names
  "tehrān", "dānte", "derīdā", "hāyzenberg", "sherūdīnger", "hīlbert", "kūyper", "cherenkof",
  "dūpler", "likert", "ārent", "kolmogorof", "voyējer", "hermes",
  "gerāys", "zhenēw", "sern", "ebōlā", "hersh", "āndrūmedā",
]);

export function isShortEException(segment: string): boolean {
  const s = segment.toLowerCase();
  if (SHORT_E_LOANWORDS.has(s)) return true;
  const stem = s.replace(/(?:hā|ī)$/u, "");
  return stem !== s && stem.length >= 4 && SHORT_E_LOANWORDS.has(stem);
}

/**
 * A short `e` that is not the ezafe: `ketāb`, `emrōz`, `mu'allem`.
 *
 * The app writes the short kasra `i` (Dari has three short vowels, a, i, u),
 * so any unmarked `e` left inside a word is either the ezafe - which is its
 * own hyphen segment and stays `-e`/`-ye` - an exempt loanword, or the
 * Iranian spelling of a Dari vowel. Majhul `ē` carries its macron and is a
 * different letter, never touched. Returns the first offending word.
 */
export function shortEVowel(translit: string | undefined): string | null {
  return shortEVowels(translit)[0] ?? null;
}

/** Every word `shortEVowel` would flag, for counting. */
export function shortEVowels(translit: string | undefined): string[] {
  if (!translit) return [];
  const found: string[] = [];
  const text = translit.normalize("NFC");
  for (const m of text.matchAll(LATIN_WORD)) {
    // A bare `e` or `ye` written as its own word after a hyphen is prose
    // quoting the ezafe (`the -e`), not a word.
    if (/^y?e$/i.test(m[0]) && text[(m.index ?? 0) - 1] === "-") continue;
    const segments = m[0].split("-");
    const bad = segments.some(
      (seg, i) => !isEzafeSegment(seg.toLowerCase(), i) && /[eE]/.test(seg) && !isShortEException(seg),
    );
    if (bad) found.push(m[0]);
  }
  return found;
}

/**
 * چه is `chi`; `che` as a word is the Iranian reading, and `chē` wrongly
 * makes it majhul. (The alphabet's letter name for چ is `chē`, a different
 * word in a field this is never run on.)
 */
export function cheAsWord(translit: string | undefined): string | null {
  if (!translit) return null;
  const m = translit.normalize("NFC").match(/(?<![\p{L}\p{M}'’-])ch[eē](?![\p{L}\p{M}'’-])/iu);
  return m ? m[0] : null;
}

// --- Word alignment and the checks that need the Dari --------------------------

const DARI_STRIP = /[‌‍ـً-ٰٟٔ]/g;
export function normDari(w: string): string {
  return w.replace(DARI_STRIP, "").replace(/ي/g, "ی").replace(/ك/g, "ک");
}

/** Dari words, with a detached می/نمی joined back to its verb. */
export function dariWords(script: string): string[] {
  const raw = script
    .split(/[\s.,،؛؟?!:;()«»"\/…]+/u)
    .map(normDari)
    .filter((w) => /[؀-ۿ]/.test(w));
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    if ((raw[i] === "می" || raw[i] === "نمی") && i + 1 < raw.length) {
      out.push(raw[i] + raw[++i]);
    } else out.push(raw[i]);
  }
  return out;
}

/** Latin and Dari words paired by position, or none when the counts differ. */
export function alignWords(translit: string, script: string): Array<[string, string]> {
  const latin = [...translit.normalize("NFC").matchAll(LATIN_WORD)].map((m) => m[0]);
  const dari = dariWords(script);
  return latin.length === dari.length ? latin.map((w, i) => [w, dari[i]]) : [];
}

/**
 * A Dari word writing a ی inside it where its transliteration shows no long
 * vowel or y at all: ریزش `rizish`, بی‌رویه `bi-rawiya`, حویلی `haweli`.
 *
 * ی is written for ī, ē or y and never for a kasra, so the Latin lost a long
 * vowel. The spelling sweep made several of these: it counted the y of an
 * ezafe `-ye` and a bare suffix `-i` as covering the root's ی, and sent the
 * root's e to i. Which long vowel it was cannot be read off the script - ē
 * in Persian roots (rēzish, pēchish), ī in Arabic patterns (tārīk, nazdīk
 * went wrong exactly that way in the drafts) - so this is reported for a
 * person to review and never applied.
 */
export function medialYehWithoutLongVowel(translit: string | undefined, script: string | undefined): string[] {
  if (!translit || !script) return [];
  const found: string[] = [];
  for (const [latin, dari] of alignWords(translit, script)) {
    if (medialYehGap(latin, dari) > 0) found.push(latin);
  }
  return found;
}

/**
 * How many ی inside the Dari word (not word-final) have no ī, ē or y inside
 * the Latin word, with the ezafe segment dropped. A final ی is left out on
 * both sides: it may be the -ī suffix written short or the ezafe's own ی.
 * Counted, not merely present: بی‌رویه has two, and `bi-rawiya`'s one y
 * covers only one of them.
 */
export function medialYehGap(latin: string, dari: string): number {
  const core = latin
    .normalize("NFC")
    .toLowerCase()
    .split("-")
    .filter((s, i) => !isEzafeSegment(s, i))
    .join("-");
  // ـایی `-āī`: the glide ی before the final ی is spoken for by that ī
  const d = normDari(dari).replace(/[یئ]ی$/u, "ی");
  const dMedial = (d.slice(0, -1).match(/[یېۍ]/g) ?? []).length;
  const lMedial = (core.slice(0, -1).match(/[īēy]/g) ?? []).length;
  return Math.max(0, dMedial - lMedial);
}

/**
 * The subjunctive/imperative prefix written `bi-`/`ba-` instead of the app's
 * `bu-`: بدانم `bidānam`, بدهید `badihēd`.
 *
 * Only a verb, and only a prefix: the rest after ب must be a present stem in
 * both scripts with a person ending after it. That keeps `bastand` (a past
 * of بستن, whose b is the root), `birinj` and `bihtar` out, and `biyā` too
 * (بیا, spelled بی, is bu + ā). بدهی `bidihī` "debt" is a noun; `nonVerbs`
 * holds the lexicon's non-verb headwords so it stays exempt.
 */
export function nonBuPrefix(
  translit: string | undefined,
  script: string | undefined,
  presentStems: ReadonlyArray<{ latin: string; dari: string }>,
  nonVerbs?: ReadonlySet<string>,
): string | null {
  if (!translit || !script) return null;
  for (const [latin, dari] of alignWords(translit, script)) {
    if (isNonBuVerb(latin, dari, presentStems, nonVerbs)) return latin;
  }
  return null;
}

export function isNonBuVerb(
  latin: string,
  dari: string,
  presentStems: ReadonlyArray<{ latin: string; dari: string }>,
  nonVerbs?: ReadonlySet<string>,
): boolean {
  const w = latin.normalize("NFC").toLowerCase();
  const D = normDari(dari);
  const m = w.match(/^b[iae](?=[^aeiouāēīōūy'-])(.+)$/u);
  if (!m || !/^ب(?!ی)/u.test(D) || nonVerbs?.has(D)) return false;
  // بدهی `bidihī` "debt" and بدهکار `bidihkār` "debtor" are nouns built on
  // the same letters; a 2sg "you give" is written budihī by then.
  if (/^bidih(?:ī|i|kār)/u.test(w)) return false;
  // a 2sg is -ī; a bare final i is a noun (bidihi, bāzi)
  if (/[^ī]i$/u.test(w)) return false;
  const rest = m[1].replace(/e/g, "i");
  return presentStems.some(
    (st) =>
      st.latin.length >= 2 &&
      rest.startsWith(st.latin) &&
      /^(|am|ī|ad|ēm|ēd|and|īm|īd)$/u.test(rest.slice(st.latin.length)) &&
      D.slice(1).startsWith(st.dari) &&
      /^(|م|ی|د|یم|ید|ند)$/u.test(D.slice(1 + st.dari.length)),
  );
}

/**
 * A short e in a field with no Dari of its own - a hub table cell, a pattern
 * part - where the i-spelling of the same word is a transliteration the app
 * uses elsewhere: `gereftan, to take` beside `giriftan`. English in the same
 * cell never matches, because `never` → `nivir` is no Dari word.
 */
export function shortEInLooseText(
  text: string | undefined,
  vocabulary: ReadonlySet<string>,
): string | null {
  if (!text) return null;
  for (const w of shortEVowels(text)) {
    if (ENGLISH_WORDS.has(w.toLowerCase())) continue;
    if (vocabulary.has(iSpelling(w))) return w;
  }
  return null;
}

/** A word with every non-ezafe e written i, lower-cased. */
export function iSpelling(word: string): string {
  return word
    .normalize("NFC")
    .toLowerCase()
    .split("-")
    .map((s, i) => (isEzafeSegment(s, i) ? s : s.replace(/e/g, "i")))
    .join("-");
}

/** Common English words that look like transliteration and must never be rewritten. */
export const ENGLISH_WORDS: ReadonlySet<string> = new Set(
  (
    "a an the be been me he she we ye her hen men ten den pen hem set sent send see seen " +
    "then them these there here were where when whet bed beg bet get jet let " +
    "led net met pet peg vet wet yet yes eg ie etc de le se ne mesh mere merit " +
    "sheer shed shell ever even event never seven eleven key keys model modern hotel " +
    "test web internet general metro opera cricket bid lid din tin sit hit pit fit kit " +
    "him his is it in if bin sin win shin chin skin " +
    // the grammar term, written as English in the course and hub prose
    "ezāfa ezafe"
  ).split(" "),
);

/**
 * A 1pl verb ending written `-īm` rather than the Kabuli majhul `-ēm`:
 * `mērawīm` for `mērawēm`, `hastīm` for `hastēm`.
 *
 * Only a verb: `taqsīm`, `ta'līm` and `qadīm` end in -īm and are nouns. A word
 * counts as a verb when it opens with the present prefix `mē-`/`namē-`, or,
 * when `isVerbStem` is given, when what is left after an optional `na`, `bu`
 * or `bi` prefix is a known verb stem (`kard`, `raft`, `hast`).
 */
export function verb1plIm(
  translit: string | undefined,
  isVerbStem?: (stem: string) => boolean,
): string | null {
  if (!translit) return null;
  for (const m of translit.normalize("NFC").matchAll(LATIN_WORD)) {
    const word = m[0].toLowerCase();
    const im = word.match(/^(.*?)-?[iī]m$/u);
    if (!im || !im[1]) continue;
    if (isVerb1plStem(im[1], isVerbStem)) return m[0];
  }
  return null;
}

/**
 * Stems a 1pl can be built on even when the lexicon gives no stem translit:
 * the copula, and three the philologist found missed (`bāshīm`: būdan has no
 * presentStemTranslit; `mānīm`: māndan's is empty; `gōyīm`).
 */
const COPULA_STEMS: ReadonlySet<string> = new Set(["hast", "nēst", "nist", "būd", "bud", "bāsh", "mān", "gōy", "bar"]);

export function isVerb1plStem(stem: string, isVerbStem?: (stem: string) => boolean): boolean {
  const s = stem.toLowerCase().replace(/-$/, "");
  if (/^(?:na)?m[ēe]-?\p{L}{2,}/u.test(s)) return true;
  // a perfect: `rafta-īm`
  if (/\p{L}{3,}a$/u.test(s) && isVerbStem?.(s.slice(0, -1))) return true;
  const bare = s.replace(/^(?:na|bu|bi)(?=\p{L}{3,})/u, "");
  for (const cand of [s, bare]) {
    if (COPULA_STEMS.has(cand)) return true;
    if (isVerbStem?.(cand)) return true;
  }
  return false;
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
