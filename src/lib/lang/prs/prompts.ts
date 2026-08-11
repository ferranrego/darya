/**
 * Dari-specific fragments spliced into the shared prompt templates in
 * `src/lib/ai/`. The templates own the task ("write a graded reader text at
 * this level"); this file owns everything that would be wrong for another
 * language - the persona, the orthography rules, the cultural settings.
 *
 * Kept as data rather than inlined so `src/lib/ai/` stays language-neutral.
 */

/** Persona. Dari is Afghan Persian; the model drifts to Iranian Persian unless told. */
export const TEACHER = "a Dari language teacher in Kabul";

/**
 * Transliteration and spelling rules. Every prompt that emits Dari or translit
 * repeats these, so they live in one place - they were previously duplicated,
 * with drift, across six prompt files.
 */
export const ORTHOGRAPHY = [
  "Write standard Afghan Dari, NOT Iranian Persian: use Dari vocabulary (مکتب، موتر، کلان) and Kabuli usage.",
  "Transliteration is Latin with Kabuli pronunciation: long vowels ā ē ī ō ū; kh/gh/ch/sh/zh/q; w for و; mē- for the present prefix.",
  "Use European-friendly digraphs rather than academic notation: kh for خ (never x - khordan, not xordan), gh for غ, sh for ش, ch for چ, zh for ژ. Apply this consistently in every field.",
  "Use ZWNJ in می‌ verb forms (می‌روم).",
].join("\n");

/**
 * Iranian Persian, which is the failure mode for Dari specifically.
 *
 * The written record is overwhelmingly Iranian, so a model asked for Persian
 * produces Tehran usage and calls it Dari. The orthography block names three
 * words; this names the constructions, which is where the drift actually shows.
 */
export const INTERFERENCE = [
  "Never use these Iranian Persian forms. The Dari is on the right:",
  "  مدرسه -> مکتب (school)",
  "  دانشگاه -> پوهنتون (university)",
  "  بیمارستان -> شفاخانه (hospital)",
  "  ماشین -> موتر (car)",
  "  خیابان -> سرک (street)",
  "  بزرگ -> کلان where 'big' is meant in the everyday sense",
  "  پول -> پیسه (money)",
  "  هواپیما -> طیاره (aeroplane)",
  "  استان -> ولایت (province)",
  "Keep the majhul vowels in transliteration: dōst not dust, shēr not shir. They are the clearest marker of Dari and Iranian Persian has lost them.",
].join("\n");

/**
 * The sentence shapes a Dari beginner should meet first, as examples.
 *
 * Kabul standard, and deliberately concrete: each is reusable with different
 * words and worth knowing on its own.
 */
export const BEGINNER_PATTERNS = [
  "دریا آبی است.",
  "خانه ما کلان است.",
  "پدر من معلم است.",
  "سگ گوشت می‌خورد.",
  "بشقاب‌ها بالای میز است.",
  "امروز آفتاب است.",
  "دوشنبه به مکتب می‌روم.",
  "سیب چند است؟",
  "نام تو چیست؟",
  "تشناب کجا است؟",
  "چای گرم را دوست دارم.",
  "در آشپزخانه نان است.",
  "امروز وقت ندارم.",
  "یک چوکی نو می‌خرم.",
].join("\n");

/** What generated reader texts should be about, culturally. */
export const CULTURAL_SETTING = "everyday Afghan life";

/** Fallback settings for generated exercises when vocabulary has no usable tags. */
export const SCENARIOS = [
  "at the bazaar",
  "at home with family",
  "traveling in Afghanistan",
  "with friends over tea",
  "at work",
  "at a restaurant",
];

export const CHAT = {
  translitTask: "Transliterate it. Transliteration rules: Latin, Kabuli pronunciation, long vowels ā ē ī ō ū, use kh/gh/ch/sh/zh/q/', w for و. Example: \"می‌روم\" → \"mērawam\".",

  tutorPersona: [
    "You are a friendly Dari speaker from Kabul, chatting with someone who is learning the language.",
    "You are their conversation partner, not their teacher: react to what they said, share a small detail about yourself, and ask them something back.",
    "Use the everyday spoken Dari of Kabul (می‌روم/مه میرم register is fine), not literary Iranian Persian, and never Iranian vocabulary like خانم دکتر-style Tehrani idiom.",
  ].join(" "),
};

/** What is worth highlighting when a sentence is broken down word by word. */
export const EXPLANATION_FOCUS = "tenses used, ezafe chains, compound verbs, the object marker rā";

/** Grammatical roles the word-by-word breakdown may use. */
export const WORD_ROLES = "Subject, Verb, Object, Ezafe, Postposition, Particle";

/** Syntactic guardrails for the language. */
export const SYNTAX = "Persian is strictly SOV (Subject-Object-Verb). The verb MUST always appear at the very end of the sentence. Use proper prepositions (like از) and ezafe (ـِ) where grammatically required; do not omit them to save words.";
