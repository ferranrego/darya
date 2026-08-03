import type { LexiconEntry } from "../../content/schema.ts";
import { conjugationSurfaces, derivePastStem, VERB_OVERRIDES, type VerbStems } from "./conjugate.ts";
import { SUPPLETIVE_FORMS } from "./suppletive.ts";
import { matchKey, ZWNJ } from "./normalize.ts";

/**
 * Fast surface-form → lexeme lookup. Headwords win over variants when both
 * claim the same key (homograph policy, see content/lexicon/README.md), and
 * authored data (headwords, variants) wins over generated conjugations.
 */
export interface LexiconIndex {
  byId: Map<string, LexiconEntry>;
  resolve: (surface: string) => LexiconEntry | null;
}

/**
 * Build the generated-verb-paradigm map (پاس 2/2b/3 below): every conjugated
 * surface a verb entry produces, keyed to whichever entry claims it first.
 *
 * Exported, not inlined in `buildLexiconIndex`, so `scripts/audit-homographs.ts`
 * can enumerate exactly the forms production resolution generates rather than
 * reimplementing this and risking the two silently drifting apart - the same
 * reasoning as `generatedSurfacesOf` in the Catalan module.
 */
export function buildGeneratedForms(
  entries: LexiconEntry[],
  headwords: Map<string, LexiconEntry>,
): Map<string, LexiconEntry> {
  // Generated verb paradigms (کرده‌ام، نمی‌روم، بخوانید…). Lowest precedence;
  // first write wins, and entries are freqRank-ordered in the lexicon file,
  // so frequent verbs claim contested keys.
  const conjugations = new Map<string, LexiconEntry>();

  // Surfaces that the paradigm generator produces but that must never win a
  // resolution, because the identical spelling is a far more common
  // construction of a different kind: a bare present stem plus the ordinary
  // ی-ye-nakira (indefinite article) that attaches to ANY noun (کتابی "a
  // book", خانه‌ای "a house"...). کاری is کار ("work/task", lx-0079) + that
  // ی, read by essentially every learner as "a task" (کاری داری؟ "do you have
  // something to do?"); but ک‌ا‌شتن ("to plant") also happens to generate a
  // bare, ب-less 2nd-person-singular subjunctive form spelled identically
  // (see conjugate.ts's `out.push(p + base + e)`), and with no sentence
  // context available at this word-level resolve() this is unrecoverable by
  // a plausibility check the way the -ان/-م stemmer guards are (see the
  // میزان/مهم fixes above this file's history). Blocking the single
  // colliding surface lets resolve()'s stemmer take over instead, which
  // already knows to strip a bare ی and land on the headword کار - the
  // correct answer for the overwhelmingly common case.
  //
  // This is deliberately a one-entry denylist, not a general rule: widening
  // it to "never register a bare 2nd-singular subjunctive" would break
  // legitimate resolution of that form for every other verb (see the "Pass
  // 2" comment below for why this map exists at all).
  const GENERATED_SURFACE_BLOCKLIST = new Set([matchKey("کاری")]);

  // Pass 2: expand verb paradigms. Simple verbs conjugate their own
  // infinitive; compound verbs (کار کردن) conjugate their light verb, but
  // only when no simple entry owns it - the tokenizer splits compounds, so
  // at token level the light verb's forms are what get tapped.
  const simpleVerbKeys = new Set(
    entries
      .filter((e) => e.pos === "verb" && !e.targetNormalized.includes(" ") && /(دن|تن)$/.test(e.targetNormalized))
      .map((e) => matchKey(e.targetNormalized))
  );
  for (const entry of entries) {
    if (entry.pos !== "verb") continue;
    const infinitive = entry.targetNormalized.split(" ").at(-1)!;
    if (!/(دن|تن)$/.test(infinitive)) continue;
    const isCompound = entry.targetNormalized.includes(" ");
    if (isCompound && simpleVerbKeys.has(matchKey(infinitive))) continue;
    if (isCompound && !entry.presentStem) continue; // carrier entries only

    const override = VERB_OVERRIDES[matchKey(infinitive)];
    const pastStem = derivePastStem(infinitive);
    if (!pastStem) continue;
    const stems: VerbStems = {
      pastStem: override?.prefix ? pastStem.slice(override.prefix.length) : pastStem,
      presentStem: override?.skip ? null : override?.presentStem ?? entry.presentStem ?? null,
      prefix: override?.prefix,
      noMiPresent: override?.noMiPresent,
    };
    for (const surface of conjugationSurfaces(stems)) {
      const key = matchKey(surface);
      if (GENERATED_SURFACE_BLOCKLIST.has(key)) continue;
      if (!conjugations.has(key)) conjugations.set(key, entry);
    }
  }

  // Pass 2b: variant infinitives conjugate too.
  //
  // `نوشیدن` is listed as a variant of the headword `آشامیدن`, so it resolved
  // as a bare infinitive and nothing else: a text saying `می‌نوشم` - the
  // ordinary way to say "I drink" - left the learner tapping a word the reader
  // could not gloss. The paradigm was only ever built from `targetNormalized`.
  //
  // The present stem cannot be taken from the headword (آشام is not نوش), but
  // `-یدن` verbs form it by dropping that suffix, which is regular: نوشیدن→نوش,
  // خریدن→خر, رسیدن→رس, پرسیدن→پرس. Anything else contributes past-tense forms
  // only, which is still better than none. Lowest precedence and first-write-
  // wins, as in pass 2, so this can never displace an authored headword.
  for (const entry of entries) {
    if (entry.pos !== "verb") continue;
    for (const variant of entry.variants) {
      const inf = variant.trim().split(" ").at(-1)!;
      if (!/(دن|تن)$/.test(inf) || simpleVerbKeys.has(matchKey(inf))) continue;
      const pastStem = derivePastStem(inf);
      if (!pastStem) continue;
      const stems: VerbStems = {
        pastStem,
        presentStem: inf.endsWith("یدن") ? inf.slice(0, -3) : null,
      };
      for (const surface of conjugationSurfaces(stems)) {
        const key = matchKey(surface);
        if (GENERATED_SURFACE_BLOCKLIST.has(key)) continue;
        if (!conjugations.has(key)) conjugations.set(key, entry);
      }
    }
  }

  // Pass 3: suppletive forms (بودن's هست/باشم, impersonal می‌توان) - not
  // derivable from any stem pair, so they are authored in SUPPLETIVE_FORMS.
  // Registered last and into the same lowest-precedence bucket, so a generated
  // conjugation or an authored headword always wins over them.
  for (const [form, infinitive] of Object.entries(SUPPLETIVE_FORMS)) {
    const owner = headwords.get(matchKey(infinitive));
    if (!owner) continue;
    const key = matchKey(form);
    if (!conjugations.has(key)) conjugations.set(key, owner);
  }

  return conjugations;
}

export function buildLexiconIndex(entries: LexiconEntry[]): LexiconIndex {
  const byId = new Map<string, LexiconEntry>();
  const headwords = new Map<string, LexiconEntry>();
  const variants = new Map<string, LexiconEntry>();

  for (const entry of entries) {
    byId.set(entry.id, entry);
    headwords.set(matchKey(entry.targetNormalized), entry);
    for (const v of entry.variants) {
      const key = matchKey(v);
      if (!variants.has(key)) variants.set(key, entry);
    }
  }

  const conjugations = buildGeneratedForms(entries, headwords);

  const lookup = (key: string) =>
    headwords.get(key) ?? variants.get(key) ?? conjugations.get(key);

  return {
    byId,
    resolve(surface: string) {
      const key = matchKey(surface);

      // 1. Exact match (headword, variant, or generated conjugation)
      let match = lookup(key);
      if (match) return match;

      // 2. Basic Stemmer for common Persian enclitics, plural markers, and comparatives
      const suffixes = [
        "یم", "ید", "ند", // verb endings (we, you pl, they)
        "ام", "ای", "ایم", "اید", "اند", // verb endings after vowels
        "ها", "ان", // plurals
        "تر", "ترین", // comparative / superlative
        "م", "ت", "ش", "ی", // possessives / singular verb endings
      ];

      for (const suffix of suffixes) {
        if (key.endsWith(suffix) && key.length > suffix.length + 1) {
          const root = key.slice(0, -suffix.length);
          // Strip ZWNJ if it was placed immediately before the suffix (e.g., خانه-ام)
          const cleanRoot = root.endsWith(ZWNJ) ? root.slice(0, -1) : root;

          match = lookup(cleanRoot);
          if (match) return match;

          // Perfect participle safety net (uncommon verbs without stems):
          // strip the participle's ه to reach the past stem, e.g. an object
          // enclitic form like دیده‌مش → دیده → دید.
          if (cleanRoot.endsWith("ه") && cleanRoot.length > 2) {
            match = lookup(cleanRoot.slice(0, -1));
            if (match) return match;
          }

          // Stacked suffixes: standard Dari only stacks plural -ها/-ان
          // *underneath* an ezafe -ی or a possessive enclitic - never the
          // reverse. Having just stripped that outer layer above, peel a
          // plural marker off what's left before giving up, e.g.
          // میوه‌های (میوه‌ها + ezafe ی) needs both layers stripped to reach
          // میوه, and دوستانش (دوستان + ش) needs both to reach دوست. Do not
          // re-enter this for suffix itself being a plural marker - that
          // would accept possessive-then-plural stacking, which is not
          // standard Dari and would widen this into guessing at arbitrary
          // suffix soup.
          //
          // Three layers is also standard and has to be tried explicitly:
          // خانه‌هایش (خانه + ها + ezafe ی + possessive ش) strips only ش here,
          // leaving خانه‌های - which ends in "ای", not "ها", so the plural
          // check below never fires unless an ezafe ی is peeled first too.
          // (کتاب‌هایم works today without this because "یم" happens to be
          // its own entry in `suffixes`, consuming ezafe+possessive in one
          // step - that is a coincidence of the array, not a general rule.)
          if (suffix !== "ها" && suffix !== "ان") {
            const rootsToTry = [cleanRoot];
            if (cleanRoot.endsWith("ی")) rootsToTry.push(cleanRoot.slice(0, -1));
            for (const candidate of rootsToTry) {
              for (const pluralSuffix of ["ها", "ان"]) {
                if (candidate.endsWith(pluralSuffix) && candidate.length > pluralSuffix.length + 1) {
                  const pluralRoot = candidate.slice(0, -pluralSuffix.length);
                  const cleanPluralRoot = pluralRoot.endsWith(ZWNJ)
                    ? pluralRoot.slice(0, -1)
                    : pluralRoot;
                  match = lookup(cleanPluralRoot);
                  if (match) return match;
                }
              }
            }
          }
        }
      }

      return null;
    },
  };
}
