import type { LexiconEntry } from "../../content/schema.ts";
import type { LexiconIndex } from "../types.ts";
import { conjugationSurfaces, type Conjugation, type CatalanVerbStems } from "./conjugate.ts";
import { IRREGULAR_VERBS, PURE_IR_VERBS } from "./irregulars.ts";
import { matchKey, normalizeCatalan } from "./normalize.ts";

/**
 * Surface-form → lexeme lookup for Catalan.
 *
 * Same precedence policy as Dari: authored headwords beat authored variants,
 * which beat generated inflections, and among generated forms the first writer
 * wins - entries are frequency-ordered, so a contested key goes to the more
 * common word. That matters more in Catalan than in Dari because accent folding
 * in `matchKey` deliberately merges pairs like `es`/`és` and `si`/`sí`.
 *
 * Beyond verbs, Catalan inflects nouns and adjectives for gender and number,
 * and those forms are far more predictable than the verb paradigm, so they are
 * generated too - otherwise a learner tapping `bones` would get nothing.
 */

/** Which conjugation an infinitive belongs to, or null if it is not one. */
export function conjugationOf(infinitive: string): Conjugation | null {
  if (/ar$/.test(infinitive)) return 1;
  if (/(re|er)$/.test(infinitive)) return 2;
  if (/ir$/.test(infinitive)) return 3;
  return null;
}

/** Build the conjugation spec for a lexicon verb entry. */
export function verbSpec(infinitive: string): CatalanVerbStems | null {
  const irregular = IRREGULAR_VERBS[infinitive];
  if (irregular) return irregular;
  const conjugation = conjugationOf(infinitive);
  if (!conjugation) return null;
  return {
    infinitive,
    conjugation,
    // The -eix- present is the majority for -ir verbs; PURE_IR_VERBS is the
    // exception list.
    incoative: conjugation === 3 && !PURE_IR_VERBS.has(infinitive),
  };
}

/**
 * Gender/number forms of a noun or adjective.
 *
 * Covers the productive patterns a reader actually meets:
 *   bo -> bona/bons/bones,  alt -> alta/alts/altes,
 *   feliç -> feliços/felices,  gran -> grans,  gos -> gossos,
 *   noi -> nois,  vowel-final -> -ns (mà -> mans is irregular and authored).
 */
const FINAL_ACCENT: Record<string, string> = {
  à: "a", è: "e", é: "e", í: "i", ï: "i", ò: "o", ó: "o", ú: "u", ü: "u",
};

/** germà -> germa, raó -> rao. Used to build the -ns plural. */
function dropFinalAccent(word: string): string {
  const last = word.slice(-1);
  return FINAL_ACCENT[last] ? word.slice(0, -1) + FINAL_ACCENT[last] : word;
}

export function nominalForms(word: string, pos: string): string[] {
  // Determiners and pronouns inflect as well - qual/quals, aquest/aquesta -
  // and without them the plural of a relative pronoun resolves to nothing.
  if (pos !== "noun" && pos !== "adjective" && pos !== "pronoun" && pos !== "determiner") {
    return [];
  }
  const w = normalizeCatalan(word);
  if (w.includes(" ")) return [];
  const out = new Set<string>();

  const plural = (base: string): string[] => {
    if (/a$/.test(base)) {
      // -a feminines take -es, with the usual consonant respelling.
      const s = base.slice(0, -1);
      if (/c$/.test(s)) return [s.slice(0, -1) + "ques"];
      if (/g$/.test(s)) return [s.slice(0, -1) + "gues"];
      if (/ç$/.test(s)) return [s.slice(0, -1) + "ces"];
      if (/j$/.test(s)) return [s.slice(0, -1) + "ges"];
      return [s + "es"];
    }
    // A stressed final vowel takes -ns: pa -> pans, bo -> bons, camí -> camins.
    // In a monosyllable the final vowel is stressed by definition.
    //
    // The written accent goes away in the -ns plural but survives in the -s one:
    // germà -> germans, raó -> raons, but cafè -> cafès. That is not a quirk of
    // this table, it falls out of Catalan accent rules - an oxytone ending in
    // -ns needs no accent, while one ending in a vowel or vowel+s does. Getting
    // it wrong makes every plural of a common kinship or abstract noun
    // (germans, raons, camins) unresolvable in the reader.
    const monosyllable = base.length <= 3;
    if (/[àéíóúè]$/.test(base) || (monosyllable && /[aeiou]$/.test(base))) {
      const bare = dropFinalAccent(base);
      // Whether the accent survives is a matter of vowel quality (béns keeps it,
      // germans does not), which spelling alone cannot decide. Both spellings
      // are emitted: these are resolution keys only, so a spurious one is inert
      // while a missing one leaves a common plural unresolvable.
      return [bare + "ns", base + "ns", bare + "s", base + "s"];
    }
    if (/[eiou]$/.test(base)) return [base + "s"];
    if (/ç$/.test(base)) return [base.slice(0, -1) + "ços"];
    // A monosyllable ending in -s doubles it: gos -> gossos, pas -> passos.
    if (/[aeiou]s$/.test(base) && base.length <= 4) return [base + "sos", base + "os"];
    if (/(s|ç|x|sc|st|xt|ig)$/.test(base)) return [base + "os", base + "s"];
    return [base + "s"];
  };

  for (const p of plural(w)) out.add(p);

  /**
   * Feminines are generated for nouns too, not only adjectives.
   *
   * Catalan nouns denoting people inflect for gender - president/presidenta,
   * professor/professora, noi/noia - and without this the feminine of every one
   * of them resolves to nothing. Over-generation is the established trade here
   * (see the note below): a spurious key is inert, a missing one means the
   * reader cannot explain a word the learner is looking at.
   */
  if (pos === "adjective" || pos === "noun" || pos === "determiner") {
    /**
     * Catalan feminines, where spelling alone cannot always decide:
     *
     *   petit -> petita   but   cansat -> cansada
     *
     * Both end in -t; the second is a participle, which voices. Which one a
     * word is cannot be read off the letters, so ambiguous endings emit BOTH
     * candidates. Over-generating is the right trade here: these forms are only
     * ever used to resolve a surface back to its lexeme, so a spurious key is
     * inert, while a missing one means the reader cannot explain a real word.
     */
    const feminines: string[] = [];

    /**
     * Whole classes of Catalan adjective are gender-invariant - "una decisió
     * important", never "importanta" - and the generic rules below assumed
     * every consonant-final adjective takes "+a", inventing "possibla",
     * "fàcila", "importanta", "populara". A catalan-philologist review,
     * sourced against DIEC2-derived tables, found these suffixes exception-
     * free or near enough to enumerate: -ble (any -able/-eble/-ible/-oble/
     * -uble) and -erior have none at all; -ar, -al, -nt and -il each have a
     * small closed list of words that look like they belong but actually
     * inflect. Scoped to adjectives only - a noun on the same ending can be a
     * person and still need its feminine (general the military rank ->
     * generala), which is the over-generation this file's docstring already
     * accepts for nouns and is unaffected here.
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
    const invariantAdjective =
      pos === "adjective" &&
      ((/[aeiou]ble$/.test(w) || /erior$/.test(w)) ||
        (/ar$/.test(w) && !AR_EXCEPTIONS.has(w)) ||
        (/al$/.test(w) && !AL_EXCEPTIONS.has(w)) ||
        (/nt$/.test(w) && !NT_EXCEPTIONS.has(w)) ||
        (/il$/.test(w) && !/òfil$/.test(w) && w !== "tranquil"));

    if (invariantAdjective) {
      // No feminine candidate at all - matched, not omitted by accident.
    } else if (w === "tranquil") {
      feminines.push("tranquil·la"); // the one common -il word with a real, irregular feminine
    } else if (/o$/.test(w)) feminines.push(w + "na", w.slice(0, -1) + "a"); // bo -> bona
    else if (/e$/.test(w)) feminines.push(w.slice(0, -1) + "a"); // pobre -> pobra
    else if (/[àíúè]$/.test(w)) feminines.push(w + "na"); // sa -> sana, comú -> comuna
    else if (/u$/.test(w)) feminines.push(w.slice(0, -1) + "va"); // blau -> blava
    else if (/ig$/.test(w)) feminines.push(w.slice(0, -2) + "ja"); // roig -> roja
    else if (/ós$/.test(w)) feminines.push(w.slice(0, -2) + "osa"); // gustós -> gustosa
    else if (/t$/.test(w)) {
      // petit -> petita, cansat -> cansada: the devoicing candidate (t -> d)
      // is a participial pattern and only fires after a vowel. After a
      // consonant - the -nt cluster of present, important, valent - it does
      // not apply at all: there is no Catalan word "presenda"/"importanda".
      // The plain "-a" candidate still is (valent -> valenta is real; that a
      // few -nt adjectives are in fact invariant - present, important - is
      // the harmless over-generation this file's own docstring accepts).
      feminines.push(w + "a");
      if (/[aeiouàèéíòóúü]t$/.test(w)) feminines.push(w.slice(0, -1) + "da");
    }
    else if (/c$/.test(w)) feminines.push(w + "a", w.slice(0, -1) + "ga"); // rica / groga
    else if (/ç$/.test(w)) feminines.push(w.slice(0, -1) + "ça");
    // An unstressed final -i takes -ia, and the stem vowel then needs its
    // written accent because the result is esdrúixola: necessari ->
    // necessària, propi -> pròpia, previ -> prèvia.
    else if (/[^aeiou]i$/.test(w)) {
      const stem = w.slice(0, -1);
      const at = stem.search(/[aeiou](?=[^aeiou]*$)/);
      const ACCENT: Record<string, string> = { a: "à", e: "è", i: "í", o: "ò", u: "ú" };
      const accented =
        at === -1 ? stem : stem.slice(0, at) + (ACCENT[stem[at]] ?? stem[at]) + stem.slice(at + 1);
      feminines.push(accented + "ia", stem + "ia");
    }
    else if (/[^aeiou]$/.test(w)) feminines.push(w + "a");

    for (const f of feminines) {
      if (!f || f === w) continue;
      out.add(f);
      for (const p of plural(f)) out.add(p);
    }
  }

  out.delete(w);
  return [...out].filter(Boolean);
}

export function buildLexiconIndex(entries: LexiconEntry[]): LexiconIndex {
  const byId = new Map<string, LexiconEntry>();
  const headwords = new Map<string, LexiconEntry>();
  const variants = new Map<string, LexiconEntry>();
  const generated = new Map<string, LexiconEntry>();

  for (const entry of entries) {
    byId.set(entry.id, entry);
    const key = matchKey(entry.targetNormalized);
    if (!headwords.has(key)) headwords.set(key, entry);
    for (const v of entry.variants) {
      const k = matchKey(v);
      if (!variants.has(k)) variants.set(k, entry);
    }
  }

  for (const entry of entries) {
    const word = entry.targetNormalized;
    const surfaces: string[] =
      entry.pos === "verb"
        ? (() => {
            // A compound/reflexive entry ("anar-se'n") conjugates its verb.
            const head = word.split(/[\s-]/)[0];
            const spec = verbSpec(head) ?? verbSpec(word);
            return spec ? conjugationSurfaces(spec) : [];
          })()
        : nominalForms(word, entry.pos);

    for (const surface of surfaces) {
      const key = matchKey(surface);
      if (!generated.has(key)) generated.set(key, entry);
    }
  }

  const lookup = (key: string) => headwords.get(key) ?? variants.get(key) ?? generated.get(key);

  return {
    byId,
    resolve(surface: string) {
      const key = matchKey(surface);
      const direct = lookup(key);
      if (direct) return direct;

      // An enclitic pronoun token ('m, 'n, -se, -hi…) is a real lexical item and
      // should be authored; if it is not, do not guess.
      if (/^'/.test(key)) return null;

      // Last resort: strip a plural -s / -os / -es so an unlisted regular plural
      // still lands on its singular.
      for (const suffix of ["ns", "os", "es", "s"]) {
        if (key.endsWith(suffix) && key.length > suffix.length + 1) {
          const hit = lookup(key.slice(0, -suffix.length));
          if (hit) return hit;
        }
      }
      return null;
    },
  };
}
