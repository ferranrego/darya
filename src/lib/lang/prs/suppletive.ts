import { ZWNJ } from "./normalize.ts";

/**
 * Suppletive Dari verb forms - the ones `conjugate.ts` provably cannot derive,
 * because they do not come from the verb's own stems.
 *
 * Everything regular (present, past, imperfect, subjunctive, imperative,
 * participle, perfect) is generated from a stem pair in `conjugate.ts` and
 * registered by `lexicon-index.ts`. Only genuine suppletion lives here:
 *
 *   - budan's present is هست/است, not *بوم, and its subjunctive is باش-
 *   - impersonal مې‌توان is a fixed form with no personal ending
 *
 * The map is form → infinitive of the lexeme the form belongs to, so a learner
 * tapping باشم is shown بودن. Forms carrying a ZWNJ are listed in both the
 * ZWNJ and joined spellings, since `matchKey` does not fold ZWNJ and real text
 * uses both (می‌توان and میتوان).
 *
 * Precedence is handled by the caller: these are registered after generated
 * conjugations and never overwrite an authored headword, so است keeps its own
 * entry while هست falls through to بودن.
 */

const BUDAN = "بودن";

function withZwnjVariants(map: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [form, lemma] of Object.entries(map)) {
    out[form] = lemma;
    if (form.includes(ZWNJ)) out[form.replaceAll(ZWNJ, "")] = lemma;
  }
  return out;
}

export const SUPPLETIVE_FORMS: Record<string, string> = withZwnjVariants({
  // budan - present (existential + copula). Not derivable from بود.
  هستم: BUDAN,
  هستی: BUDAN,
  هست: BUDAN,
  هستیم: BUDAN,
  هستید: BUDAN,
  هستند: BUDAN,
  نیستم: BUDAN,
  نیستی: BUDAN,
  نیست: BUDAN,
  نیستیم: BUDAN,
  نیستید: BUDAN,
  نیستند: BUDAN,

  // budan - subjunctive (باش-). Core A2: باید ... باشم, and the past
  // subjunctive رفته باشم. This is the paradigm that was missing entirely.
  باشم: BUDAN,
  باشی: BUDAN,
  باشد: BUDAN,
  باشیم: BUDAN,
  باشید: BUDAN,
  باشند: BUDAN,
  نباشم: BUDAN,
  نباشی: BUDAN,
  نباشد: BUDAN,
  نباشیم: BUDAN,
  نباشید: BUDAN,
  نباشند: BUDAN,

  // Impersonal "one can" - a fixed form with no personal ending, so the
  // derived توان- paradigm does not cover it.
  [`می${ZWNJ}توان`]: "توانستن",
  [`نمی${ZWNJ}توان`]: "توانستن",
});
