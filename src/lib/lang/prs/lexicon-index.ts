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

export function buildLexiconIndex(entries: LexiconEntry[]): LexiconIndex {
  const byId = new Map<string, LexiconEntry>();
  const headwords = new Map<string, LexiconEntry>();
  const variants = new Map<string, LexiconEntry>();
  // Generated verb paradigms (کرده‌ام، نمی‌روم، بخوانید…). Lowest precedence;
  // first write wins, and entries are freqRank-ordered in the lexicon file,
  // so frequent verbs claim contested keys.
  const conjugations = new Map<string, LexiconEntry>();

  for (const entry of entries) {
    byId.set(entry.id, entry);
    headwords.set(matchKey(entry.targetNormalized), entry);
    for (const v of entry.variants) {
      const key = matchKey(v);
      if (!variants.has(key)) variants.set(key, entry);
    }
  }

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
        }
      }

      return null;
    },
  };
}
