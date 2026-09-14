/**
 * Kabul spoken Dari, for reading.
 *
 * Dari has a formal written form and a very different Kabul spoken form, and
 * the dictionary is 58% formal against 1% spoken. The insight that makes this
 * fixable in a text-only app is that Kabul spoken Dari is a *written* register
 * too: Afghans type it constantly, in messages, comments and subtitles. So
 * teaching it for reading is not a consolation prize for having no audio - it
 * is teaching people to read what Afghans actually write.
 *
 * The audit that produced this expected the recogniser to reject these forms
 * outright. Measured, it does something worse for three of them: it resolves
 * them to a *different word*, silently.
 *
 *   ره   → رستن   "to escape"   (it is the object marker, را)
 *   بری  → بردن   "to carry"    (it is برای, "for")
 *   مه   → مه     "fog"         (it is من, "I")
 *
 * A learner tapping one of those in a message from a real Afghan speaker gets
 * the wrong word written into their review deck, and nothing anywhere looks
 * broken. That is the `registre` failure this repo already has a rule about.
 *
 * Of those three, only بری was fixed here at first. مه and ره looked like
 * genuine homographs - the lexicon really does contain مه "fog", and it listed
 * ره as a stem of رستن "to escape" - and a table that quietly outranked stated lexicon entries would be
 * the same defect pointing the other way: a text about weather would stop
 * resolving مه as weather. They are listed in `CONTESTED_SPOKEN` below with the
 * reasoning, pinned by a test so a new collision cannot appear unnoticed, and
 * left for a philologist to decide - which is a decision about Dari, not about
 * code. ره has since been decided. It is a real word - the classical present
 * stem of رستن and رهیدن (می‌رهد), and poetic for راه - but bare ره in shipped
 * content is always Kabuli را, all five uses. The lexicon listed it as a
 * variant on both verbs; with those variants removed, this table resolves it
 * to را.
 *
 * مو (mu, "we") and شمو (shumu, "you" plural) used to be listed too, and have
 * been removed on exactly that kind of decision. A philologist ruled, citing
 * Glassman's Conversational Dari (1971) and Encyclopaedia Iranica "Kabuli",
 * that the Kabul pronouns are mā and shumā - the same words as the written
 * ما and شما - so neither form is Kabuli at all. That made the entries wrong
 * in both directions the table is used: `spokenFormOf("ما")` showed every
 * learner who opened ما, one of the most frequent words in the app, "how Kabul
 * says it: مو mu", teaching a form Kabul does not use; and مو was never
 * resolved as "we" anyway, because it collides with مو "hair" (it was in
 * `CONTESTED_SPOKEN`). Removing them costs one resolution, شمو → شما, which
 * occurs nowhere in shipped content. If a variety that does say mu/shumu is
 * ever taught, it gets its own table - not the one labelled Kabul.
 *
 * Everything here is written by hand and reviewed, never derived: a guessed
 * form is one a learner will memorise as correct. The list is deliberately
 * short and closed rather than a general phonology of Kabuli - a small table
 * that is right beats a broad rule that is usually right.
 */
import { matchKey } from "./normalize.ts";

/**
 * Spoken surfaces and the formal headword each one is.
 *
 * Keyed by `matchKey` at build time, values are `targetNormalized` of the
 * entry they mean. Closed class only: pronouns, the copula, the object marker
 * and a handful of the most frequent contracted verb forms. Anything requiring
 * judgement about a specific noun is not here.
 */
export const SPOKEN_FORMS: Readonly<Record<string, string>> = {
  // Pronouns and the object marker.
  مه: "من", // ma - "I". Homographic with مه "fog", which see below.
  ره: "را", // ra - object marker, written as a separate word
  // No مو/شمو: Kabul says mā and shumā, written ما and شما. See the header.
  // "for" - بری is also a real form of بردن, which is why it resolves wrongly.
  بری: "برای",
  // The copula, which in Kabuli attaches and shortens.
  استم: "بودن",
  استی: "بودن",
  استیم: "بودن",
  استین: "بودن",
  استن: "بودن",
  // Contracted present of the highest-frequency verbs. Hand-written per form
  // rather than generated, because the contraction is not regular: رفتن loses
  // its stem vowel (mē-rawam → mērum) where کردن does not.
  میرم: "رفتن",
  میری: "رفتن",
  میره: "رفتن",
  میریم: "رفتن",
  میرین: "رفتن",
  میرن: "رفتن",
  میگم: "گفتن",
  میگی: "گفتن",
  میگه: "گفتن",
  میگیم: "گفتن",
  میگن: "گفتن",
  میایم: "آمدن",
  میای: "آمدن",
  میایه: "آمدن",
  میتانم: "توانستن",
  میتانی: "توانستن",
  میتانه: "توانستن",
};

/**
 * Spoken forms that a real lexicon entry already claims.
 *
 * These stay resolving to the lexicon's own answer. Listing them is the point:
 * the alternative is discovering the collision when a learner taps مه in a
 * chat message and gets "fog", which is how this class of defect has always
 * been found here. A test asserts this set is exactly the set of collisions,
 * so adding a spoken form that silently does nothing fails the suite.
 *
 *   مه  - Kabuli "I", and the noun "fog"
 *   استین - Kabuli "you are" (plural), and آستین "sleeve": `matchKey` folds
 *           ا and آ together, so the two are the same key. This one was found
 *           by the test below rather than by reading the list, which is the
 *           argument for the test existing.
 *
 * (مو "we" was listed here too, until it was ruled not to be Kabuli at all
 * and removed from the table - see the header. ره was listed as well, while
 * رستن and رهیدن carried it as a variant. It is their classical present stem,
 * but bare ره in content is always the Kabuli را, so dropping those variants
 * let this table answer it - see the header.)
 *
 * These are far more common as the Kabuli form in anything a learner would
 * import or be sent, so overriding is probably right - but "probably" is not
 * the standard for a word written into somebody's review deck.
 */
export const CONTESTED_SPOKEN: ReadonlySet<string> = new Set(["مه", "استین"]);

/**
 * How Kabul pronounces each of those, for the "how Kabul says it" line.
 *
 * Kept beside the forms rather than derived from them: the app has no audio,
 * so this transliteration is the only pronunciation a learner ever gets, and
 * deriving it would be guessing at exactly the point where guessing is worst.
 */
export const SPOKEN_TRANSLIT: Readonly<Record<string, string>> = {
  مه: "ma",
  ره: "ra",
  بری: "barē",
  استم: "astum",
  استی: "astī",
  استیم: "astēm",
  استین: "astēn",
  استن: "astan",
  میرم: "mērum",
  میری: "mērī",
  میره: "mēra",
  میریم: "mērēm",
  میرین: "mērēn",
  میرن: "mēran",
  میگم: "mēgum",
  میگی: "mēgī",
  میگه: "mēga",
  میگیم: "mēgēm",
  میگن: "mēgan",
  میایم: "mēyāyum",
  میای: "mēyāyī",
  میایه: "mēyāya",
  میتانم: "mētānum",
  میتانی: "mētānī",
  میتانه: "mētāna",
};

/**
 * The Kabuli plural, `-ā` for formal `-hā`.
 *
 * Productive rather than listed, because it applies to every noun: کتاب‌ها
 * becomes کتابا. Returns the bare noun to look up, or null when the rule does
 * not apply. The caller checks that what comes back is actually a noun - a
 * rule that fires on any word ending in alef would swallow half the verbs.
 */
export function spokenPluralBase(key: string): string | null {
  if (!key.endsWith("ا") || key.length < 4) return null;
  return key.slice(0, -1);
}

/** Lookup table keyed the way the index keys everything else. */
export const SPOKEN_BY_KEY: ReadonlyMap<string, string> = new Map(
  Object.entries(SPOKEN_FORMS).map(([spoken, formal]) => [matchKey(spoken), formal]),
);

/**
 * The Kabul spoken form of a formal headword, for display.
 *
 * The reverse of the table above, and empty for the overwhelming majority of
 * words: most of the dictionary sounds the same in both registers, and the
 * line is only worth showing where the two actually differ. Returns the first
 * listed form - for verbs that is the first person, which is what a phrasebook
 * would give.
 */
export function spokenFormOf(targetNormalized: string): { target: string; translit: string } | null {
  for (const [spoken, formal] of Object.entries(SPOKEN_FORMS)) {
    if (formal === targetNormalized) {
      return { target: spoken, translit: SPOKEN_TRANSLIT[spoken] ?? "" };
    }
  }
  return null;
}
