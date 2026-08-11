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

/**
 * Castilianisms, which are the failure mode for Catalan specifically.
 *
 * Every pair here is a construction a model trained mostly on Spanish reaches
 * for, and each is wrong in a way that reads as fluent. They are stated as
 * substitutions rather than prohibitions because "avoid castellanismes" is
 * advice the model cannot act on.
 */
/**
 * The mechanically checkable half of the castilianisms, as data.
 *
 * See the note on `INTERFERENCE_RULES` in the Dari profile: as prose these can
 * only advise a model, as a table they also become a free check the composer
 * runs on the learner's draft before anything is sent.
 *
 * Only substitutions that can be recognised from the words alone belong here.
 * `estranyar` for "to miss" and the personal `a` need to know what the sentence
 * means, so they stay in the prose lines below - a check that fires on correct
 * Catalan is worse than no check, because the learner stops trusting it.
 */
export const INTERFERENCE_RULES = [
  {
    wrong: "hi han",
    right: "hi ha",
    whyEn: "“hi ha” is invariable: always singular, even with a plural noun.",
  },
  {
    wrong: "tinc que",
    right: "he de",
    whyEn: "Obligation is “haver de”, not “tenir que” (he d'anar, not tinc que anar).",
    alsoMatch: ["tens que", "té que", "tenim que", "teniu que", "tenen que", "tenir que"],
  },
  {
    wrong: "em dono compte",
    right: "me n'adono",
    whyEn: "The verb is “adonar-se”, not “donar-se compte”.",
    alsoMatch: ["et dones compte", "es dona compte", "donar-se compte", "donar compte"],
  },
  {
    wrong: "degut a",
    right: "a causa de",
    whyEn: "“Degut a” is a castilianism; use “a causa de” or “per culpa de”.",
  },
  {
    wrong: "lo",
    right: "el / el que / allò",
    whyEn: "Catalan has no neuter article “lo”: el que és important, not lo important.",
  },
];

export const INTERFERENCE = [
  "Never use these Spanish-influenced forms. The correct Catalan is on the right:",
  ...INTERFERENCE_RULES.map((r) => `  ${r.wrong} -> ${r.right} (${r.whyEn})`),
  "  al + infinitive -> quan + verb (quan arribo, not al arribar)",
  "  estranyar meaning 'to miss' -> enyorar, trobar a faltar (estranyar is 'to find odd')",
  "  buscar/trobar a algú with personal a -> no personal a in Catalan (veig la Maria, not veig a la Maria)",
  "  the gerund for a following action -> a finite verb (va caure i es va trencar, not caient es va trencar)",
  "Adjectives normally follow the noun (la parada següent, un problema greu).",
].join("\n");

/**
 * The sentence shapes a Catalan beginner should meet first, as examples.
 *
 * Each one is worth knowing on its own and reusable with different words, which
 * is what a first-week learner actually needs from a text.
 */
export const BEGINNER_PATTERNS = [
  "El riu és blau.",
  "La casa era gran.",
  "El meu pare és intel·ligent.",
  "El gos menja carn.",
  "Els plats són a taula.",
  "Avui fa sol.",
  "Els dilluns treballo molt.",
  "Quant costa la poma?",
  "Quin és el teu nom?",
  "On és el bany?",
  "M'agrada el cafè amb llet.",
  "Hi ha pa a la cuina.",
  "No tinc temps avui.",
  "Vull comprar una taula nova.",
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

export const CHAT = {
  translitTask: "Provide a phonetic pronunciation guide so an English speaker knows how to pronounce it. Example: \"com estàs\" -> \"kohm eh-stahs\".",

  tutorPersona: [
    "You are a friendly Catalan speaker from Barcelona, chatting with someone who is learning the language.",
    "You are their conversation partner, not their teacher: react to what they said, share a small detail about yourself, and ask them something back.",
    "Write natural spoken Central Catalan, the way someone actually texts a friend, and never Spanish.",
  ].join(" "),
};

/**
 * What is worth highlighting when a sentence is broken down word by word.
 * The Catalan equivalents of the features a Dari breakdown would name: weak
 * pronouns rather than ezafe, periphrastic past rather than compound verbs.
 */
export const EXPLANATION_FOCUS =
  "tenses used, weak pronoun combinations (me'n, l'hi, els hi), the periphrastic past, ser vs estar, apostrophation and contractions";

/** Grammatical roles the word-by-word breakdown may use. */
export const WORD_ROLES = "Subject, Verb, Direct object, Indirect object, Weak pronoun, Preposition, Article, Conjunction";

export const SYNTAX = "Ensure strictly correct Catalan syntax without Spanish interference (Castilianisms). Crucially: do NOT use the personal 'a' for direct objects (e.g., write 'Veig la Maria', never 'Veig a la Maria'), and use weak pronouns correctly.";
