/**
 * Catalan-specific fragments spliced into the shared prompt templates.
 *
 * The orthography block is doing real work: a model asked for "Catalan" drifts
 * toward Spanish spelling and toward Valencian/Balearic verb forms. Pinning
 * Central Catalan and naming the traps (accents, ela geminada, apostrophes)
 * up front is what keeps generated text consistent with the lexicon - and the
 * OOV check rejects the text when it is not.
 */

export const TEACHER = "a Catalan teacher in Barcelona";

export const ORTHOGRAPHY = [
  "Write standard Central Catalan (the Barcelona standard), NOT Valencian or Balearic forms, and never Spanish.",
  "Spelling must be exact: accents (à è é í ò ó ú), dieresi (ï ü), ce trencada (ç), and ela geminada written with the interpunct (col·legi, paral·lel - never 'colegi' or 'col.legi').",
  "Apostrophise correctly: l'home, l'aigua, d'un, s'ha, n'hi ha. Use the periphrastic past (vaig menjar) rather than the simple past (mengí), which is literary.",
  "Weak pronouns take their standard written forms: em, et, es, ens, us, el, la, els, les, li, hi, en - with apostrophes and hyphens as required (me'n vaig, dona-me'l).",
].join("\n");

/** What generated reader texts should be about. */
export const CULTURAL_SETTING = "everyday life in Catalonia";

export const SCENARIOS = [
  "at the market",
  "at home with family",
  "travelling around Catalonia",
  "with friends at a bar",
  "at work",
  "at a restaurant",
  "at the beach",
  "during a local festa major",
];
