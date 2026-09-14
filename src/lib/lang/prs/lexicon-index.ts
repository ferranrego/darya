import type { LexiconEntry } from "../../content/schema.ts";
import { conjugationSurfaces, derivePastStem, VERB_OVERRIDES, type VerbStems } from "./conjugate.ts";
import { SUPPLETIVE_FORMS } from "./suppletive.ts";
import { matchKey, ZWNJ } from "./normalize.ts";
import { SPOKEN_BY_KEY, spokenPluralBase } from "./spoken.ts";

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
/**
 * Why `normalized` cannot be a Dari verb headword, or null if it can.
 *
 * Two rules, in the order the content gate applied them before they moved here,
 * plus the exemption list they always had: است، باشد and باید are finite forms
 * and a modal, kept as standalone headwords because learners meet them
 * constantly and look them up by themselves.
 *
 * That exemption used to live in `validate-content.ts` as a set of lexeme ids.
 * All three ids also exist in the Catalan lexicon (`ens`, `fins després`,
 * `llet`), so once the check stopped being gated on `lang === "prs"` the ids
 * would have exempted Catalan entries too. They are not verbs today, so
 * nothing changed - but that is an accident, not a guarantee. Keyed on the
 * Dari word instead, it cannot reach another language at all.
 *
 * A headword must be an infinitive: compound verbs (کار کردن) conjugate their
 * light verb, so it is the last space-separated part that has to end in دن/تن.
 * `derivePastStem` is the same test - reused rather than re-written, so the
 * validator and the conjugator cannot disagree about what an infinitive is.
 *
 * And a compound must be space-separated, because that space is how
 * `buildLexiconIndex` finds the light verb. A ZWNJ standing in for it
 * (استخدام‌کردن) silently defeats that - the entry looks fine and conjugates to
 * nothing. A ZWNJ *inside* a part is legitimate (هیجان‌زده شدن), so only an
 * entry with no space at all is wrong.
 */
/**
 * Dari generates verb paradigms only - nominal plural/possessive forms are
 * resolved by stripping suffixes at lookup time (see `resolve`'s stemmer)
 * rather than expanded into a static map, so there is nothing else to enumerate.
 *
 * `buildGeneratedForms` returns the folded key without the original spelling
 * (it is built for lookup, not display). The key is still legible Dari - only
 * diacritics and alef variants are folded - so it doubles as the surface.
 */
export function generatedFormsByKey(
  entries: LexiconEntry[],
  headwordByKey: Map<string, LexiconEntry>,
): Map<string, { entry: LexiconEntry; surface: string }> {
  const out = new Map<string, { entry: LexiconEntry; surface: string }>();
  for (const [key, entry] of buildGeneratedForms(entries, headwordByKey)) {
    out.set(key, { entry, surface: key });
  }
  return out;
}

const NON_INFINITIVE_HEADWORDS = new Set(["است", "باشد", "باید"]);

export function verbHeadwordProblem(normalized: string): string | null {
  if (NON_INFINITIVE_HEADWORDS.has(normalized)) return null;
  const head = normalized.split(" ").at(-1)!;
  if (!derivePastStem(head)) return "is not an infinitive";
  if (!normalized.includes(" ") && normalized.includes(ZWNJ)) {
    return "is a compound verb joined with ZWNJ, use a space";
  }
  return null;
}

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
  // A verb listed only as a variant of another headword (a literary synonym)
  // resolved as a bare infinitive and nothing else, because the paradigm was
  // only ever built from `targetNormalized`. The case that found it was
  // `نوشیدن`, then a variant of `آشامیدن`: a text saying `می‌نوشم` left the
  // learner tapping a word the reader could not gloss. نوشیدن has since got
  // its own headword (lx-6365), so می‌نوشم resolves through pass 2 and that
  // variant was removed as shadowed; the pass still serves any verb that is
  // a variant only.
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
    // A Dari headword never contains a digit. The 160 that do (lx-5070 to
    // lx-5229, "گرمایش جهانی 1" … "محیط زیست 160") are bulk-generation
    // filler, ruled out in their gloss and kept only because user_words may
    // reference their ids. `byId` still finds them for that reason; nothing
    // may reach them by lookup, including a caller that resolves a whole
    // phrase rather than a token.
    if (/[0-9۰-۹٠-٩]/.test(entry.targetNormalized)) continue;
    headwords.set(matchKey(entry.targetNormalized), entry);
    for (const v of entry.variants) {
      const key = matchKey(v);
      if (!variants.has(key)) variants.set(key, entry);
    }
  }

  const conjugations = buildGeneratedForms(entries, headwords);

  /**
   * Kabul spoken forms, between the exact match and the generated paradigms.
   *
   * Placement is the whole decision. Above the headwords it would rewrite
   * words that already have their own entry - مه is genuinely both Kabuli "I"
   * and the noun "fog", and a text about weather must keep resolving it as
   * weather. Below the stemmer it would never fire, because the stemmer
   * already reaches a wrong answer for ره and بری. Here it fixes the silent
   * mis-resolutions without overruling anything the lexicon states outright.
   */
  const spoken = new Map<string, LexiconEntry>();
  for (const [key, formal] of SPOKEN_BY_KEY) {
    const entry = headwords.get(matchKey(formal));
    // A spoken form pointing at a headword the lexicon does not have is a
    // defect in the table, not something to paper over at runtime.
    if (entry) spoken.set(key, entry);
  }

  const lookup = (key: string) =>
    headwords.get(key) ?? variants.get(key) ?? spoken.get(key) ?? conjugations.get(key);

  /** A key that is only a verb's listed bare stem (چر، کن), not a finite form or a headword. */
  const isBareStem = (key: string) =>
    !headwords.has(key) && variants.get(key)?.pos === "verb" && !conjugations.has(key);

  return {
    byId,
    resolve(surface: string) {
      const key = matchKey(surface);

      // 1. Exact match (headword, variant, or generated conjugation)
      let match = lookup(key);
      if (match) return match;

      // 2. The Kabuli plural: کتابا for کتاب‌ها. Productive, so it is a rule
      // rather than a listed form - but only accepted when what is left is
      // actually a noun, since a rule firing on any word ending in alef would
      // swallow half the verb paradigms.
      //
      // A three-letter base is where the rule meets Arabic: the broken plural
      // faʿalā (فقرا "the poor", فقها "jurists") and the maṣdar ifʿāl (اجرا
      // "performance", 14 content tokens) are spelled exactly like a Kabuli
      // plural of فقر "poverty", فقه, آجر "brick". None of those words is in the
      // lexicon, so nothing outranked the wrong reading, and اصلاً "at all"
      // (tanwin folds away) became اصل "principle", and سرما "cold" reached سر
      // "head" through its variant سرم. Content had 3 correct Kabuli plurals
      // through this rule (کتابا) against 19 wrong tokens, every one on a
      // three-letter base, so the rule needs four. The cost: روزا, سالا
      // stay unresolved - unresolved, not wrong.
      const pluralBase = spokenPluralBase(key);
      if (pluralBase && pluralBase.length >= 4) {
        const noun = lookup(pluralBase);
        if (noun && noun.pos === "noun") return noun;
      }

      // 3. Basic Stemmer for common Persian enclitics, plural markers, and comparatives
      const suffixes = [
        "یم", "ید", "ند", // verb endings (we, you pl, they)
        "ام", "ای", "ایم", "اید", "اند", // verb endings after vowels
        "ات", "اش", // possessives after a silent-h noun (خانه‌ات، خانه‌اش) - ZWNJ only, see below
        "ها", "ان", // plurals
        // Plural possessives (کتابتان، خانه‌شان). After "ان" on purpose: a
        // surface like درختان must be tried as the plural of درخت before it
        // is tried as درخ + تان, and the plural reading is the one that wins
        // when both roots exist.
        "مان", "تان", "شان",
        "تر", "ترین", // comparative / superlative
        "م", "ت", "ش", "ی", // possessives / singular verb endings
      ];

      // -at and -ash with their alef are the silent-h spelling, which always
      // carries the ZWNJ (خانه‌ات). Without it the same letters are an Arabic
      // plural or part of the stem - امکانات "facilities" is not "your امکان"
      // (possibility), and it is not in the lexicon, so nothing else would
      // stop that split - and after a consonant the enclitic
      // is written bare (کتابت) and already reached by "ت"/"ش".
      const zwnjOnly = new Set(["ات", "اش"]);

      // -mān/-tān/-shān are written bare, so unlike -at/-ash they cannot be
      // told apart from stem letters by spelling - and -stān is also the
      // place-noun suffix. پستان "breast" peeled to پس "then", and بوستان
      // "garden" to بوس, the imperative of بوسیدن. Neither word is in the
      // lexicon, so nothing outranked the wrong reading. A possessive sits on
      // a noun, pronoun, determiner or preposition (کتابتان، خودتان، همه‌شان،
      // برایتان), not a bare adverb or verb stem, so a root that resolves to
      // one of those is treated as a false split and left unresolved. The
      // known cost: پیش is tagged adverb, so پیشتان stays unresolved, as it
      // was before these suffixes existed.
      const pluralPossessives = new Set(["مان", "تان", "شان"]);

      // Every guard below was found the same way: by resolving every token in
      // shipped content, listing the ones reached by stripping, and reading
      // them. Each one answered a DIFFERENT word - not a near miss, a wrong
      // card in a learner's deck. A guard rejects a split the orthography or
      // grammar rules out; it never picks between two readings, so what it
      // costs is an unresolved token, never a new wrong one.
      //
      // Person endings (یم ید ند ام ای ایم اید اند) on a verb: every finite
      // form is already generated, so a verb reached only by stripping one is
      // a second ending stacked on a finite form - بازدید "visit" as بازد
      // (subjunctive of باختن "to lose") + ید. A verb HEADWORD is exempt: است
      // is a finite form kept as its own entry, and Kabuli استند "they are"
      // really is است + ند.
      const personEndings = new Set(["یم", "ید", "ند", "ام", "ای", "ایم", "اید", "اند"]);
      // Plurals and comparatives attach to what can be counted or compared.
      // داده‌ها "data" and بخش‌های "parts" peeled to دادن "to give" and
      // بخشیدن "to forgive"; میان "between" to the می- prefix; بهترین "best"
      // (16 tokens) and برتر "superior" to the prepositions به and بر.
      const neverPlural = new Set(["verb", "particle", "preposition", "conjunction", "interjection"]);
      const comparable = new Set(["adjective", "adverb", "noun"]);
      // The bare single-letter enclitics.
      const bareEnclitics = new Set(["م", "ت", "ش"]);

      /**
       * Whether `root` + `suffix` is a split Dari can actually spell, given
       * that `root` resolved to `m`. `bare` is true when no ZWNJ separated them.
       */
      const fits = (suffix: string, m: LexiconEntry, root: string, bare: boolean) => {
        if (pluralPossessives.has(suffix) && (m.pos === "verb" || m.pos === "adverb")) return false;
        if (personEndings.has(suffix) && m.pos === "verb" && !headwords.has(root)) return false;
        // -and "they are" is a copula, and a copula attaches to what can be
        // predicated (خوبند، استادند) - never to a function word. باند
        // "runway, gang" peeled to با "with" + ند once a wrong variant stopped
        // catching it first. Only the 3pl: -am, -ī, -ēm, -ēd are also spelled
        // like a possessive or a glide + possessive, which a preposition does
        // take (درباره‌ام "about me", برایم).
        if ((suffix === "ند" || suffix === "اند") && neverPlural.has(m.pos) && m.pos !== "verb") return false;
        if ((suffix === "ها" || suffix === "ان") && neverPlural.has(m.pos)) return false;
        if ((suffix === "تر" || suffix === "ترین") && !comparable.has(m.pos)) return false;
        if (bareEnclitics.has(suffix) && bare) {
          // After a vowel-final word the enclitic takes a glide: پایم, رویش,
          // برایت - never bare. So a bare م/ت/ش after ا or و is stem letters:
          // باش "be!" is not با "with" + ش, nor بام "roof" با + م, تام
          // "complete" تا + م, جوش "boil" جو + ش, حیات "life" حیا + ت, and
          // قطعات "pieces" is not قطعاً "definitely" + ت.
          if (/[او]$/.test(root)) return false;
          // After -ī the same holds (the enclitic follows a ZWNJ and an alef:
          // صندلی‌ات), and a bare ت there is the Arabic abstract -iyyat:
          // قابلیت is not "your قابلی", قطعیت not "your قطعی" (outage). The
          // glide spelling itself - برای + ت - ends in ای/وی and is allowed,
          // and so is a finite verb (بگیریش).
          if (/[^او]ی$/.test(root) && m.pos !== "verb") return false;
          // A verb reached through a bare present stem, which is only ever
          // listed as a variant (چر, آموز, تاب, کن): an enclitic pronoun
          // attaches to a finite form (دیدمش، می‌بینمت), never to a stem,
          // and stem + ش/ت is the -ish/-t noun instead - چرت "nap" is not
          // چریدن "to graze", آموزش "education" not آموختن.
          if (m.pos === "verb" && isBareStem(root)) return false;
        }
        return true;
      };

      for (const suffix of suffixes) {
        if (key.endsWith(suffix) && key.length > suffix.length + 1) {
          const root = key.slice(0, -suffix.length);
          if (zwnjOnly.has(suffix) && !root.endsWith(ZWNJ)) continue;
          // The other alef-initial endings (-am, -ē, -ēm, -ēd, -and) follow a
          // vowel the same way: after a ZWNJ or a silent h (خانه‌ام، رفته‌اند).
          // After a consonant Dari writes the enclitic without the alef
          // (کتابم، خوبند), so a bare alef there belongs to the word: صدای is
          // صدا "sound" + ی and not صد "hundred" (12 tokens), دارای is not دار
          // "gallows", اتمام "completion" is not اتم "atom", مدام "constantly"
          // is not مد "fashion". Skipping lets the shorter ی/م be tried next,
          // which is how صدای still reaches صدا.
          if (personEndings.has(suffix) && suffix.startsWith("ا") && !root.endsWith(ZWNJ) && !root.endsWith("ه")) {
            continue;
          }
          // Strip ZWNJ if it was placed immediately before the suffix (e.g., خانه-ام)
          const bare = !root.endsWith(ZWNJ);
          const cleanRoot = root.endsWith(ZWNJ) ? root.slice(0, -1) : root;

          // -tarīn is -tar + -īn, so a comparative the lexicon lists as its own
          // word is the nearer lexeme: بهترین "best" is بهتر "better" + ین. The
          // comparative guard below stops it reaching به "to", which is what
          // it answered in the superlatives lesson before; without this it
          // would have fallen to unresolved instead.
          if (suffix === "ترین") {
            match = lookup(key.slice(0, -2));
            if (match && fits("تر", match, cleanRoot, bare)) return match;
          }

          match = lookup(cleanRoot);
          if (match && fits(suffix, match, cleanRoot, bare)) return match;

          // Perfect participle safety net (uncommon verbs without stems):
          // strip the participle's ه to reach the past stem, e.g. an object
          // enclitic form like دیده‌مش → دیده → دید.
          //
          // Verbs only - that is the whole premise. On a noun it strips the
          // noun's own final h: ایده‌ها "ideas" became اید "Id", کمیته‌ای
          // "a committee" کمیت "quantity", حرفه‌ای "professional" حرف "word",
          // لبه‌ای "edge" لب "lip".
          if (cleanRoot.endsWith("ه") && cleanRoot.length > 2) {
            match = lookup(cleanRoot.slice(0, -1));
            if (match && match.pos === "verb" && fits(suffix, match, cleanRoot, bare)) return match;
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
                  if (
                    match &&
                    fits(suffix, match, cleanRoot, bare) &&
                    fits(pluralSuffix, match, cleanPluralRoot, !pluralRoot.endsWith(ZWNJ))
                  ) {
                    return match;
                  }
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
