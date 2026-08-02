import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildLexiconIndex as buildCa } from "../lang/ca/lexicon-index.ts";
import { tokenizeCatalan } from "../lang/ca/normalize.ts";
import { buildLexiconIndex as buildPrs } from "../lang/prs/lexicon-index.ts";
import { tokenizeDari } from "../lang/prs/normalize.ts";
import { lexiconFileSchema, type LexiconEntry } from "./schema.ts";
import { isTeachable } from "./teachability.ts";
import { BEGINNER_CORE_TAG } from "./word-selection.ts";

/**
 * Can a beginner actually say anything?
 *
 * Every other check here counts words, and a count proves nothing. The Catalan
 * lexicon held 4,345 entries while a first-week learner could not write *jo*,
 * *aquest*, *sota*, *tres* or *el gat dorm sota la taula*, because the words
 * were present and unreachable at the level that needs them. Counting said the
 * lexicon was fine. Only asking "can this sentence be built?" said otherwise.
 *
 * So this is the gate: real sentences a beginner should meet in their first
 * weeks, tokenized with the production tokenizer and resolved through the
 * production morphology index. Every word has to land on an entry that is
 * teachable *and* tagged `beginner-core`, which is exactly the claim the
 * generator relies on when it lets the first levels teach outside their band.
 *
 * It also documents intent in a form a philologist can review directly - the
 * sentences are the specification, readable without any of the code - and it
 * costs no provider call.
 *
 * When this fails, the fix is content, not the test: author the missing word,
 * or state in `beginner-spec.json` why the sentence is out of scope.
 *
 * Two limits worth stating, because passing here does not mean they are solved:
 *
 *   - This asserts *reachability*, not that the gloss is right in context.
 *     `costa` in "Quant costa la poma?" resolves to the noun `costa` (coast),
 *     not to `costar`, because an authored headword outranks a generated verb
 *     form. The learner gets a gloss; it is the wrong one. Homograph
 *     disambiguation needs sentence context and is not built.
 *   - Multi-word entries (`خدا حافظ`, `si us plau`) cannot be reached through a
 *     tokenizer that splits on whitespace, so they are asserted separately
 *     below rather than inside a sentence.
 */

const CA_SENTENCES = [
  // being, having, identity
  "Jo soc estudiant.",
  "Com et dius?",
  "Quin és el teu nom?",
  "El meu pare és intel·ligent.",
  "La meva mare treballa a l'hospital.",
  "Aquest és el meu germà.",
  "Tenim una casa petita.",
  "No tinc gana.",
  "Ella té dos fills.",
  "Som quatre a casa.",
  // description
  "El riu és blau.",
  "La casa era gran.",
  "El gat és molt gras.",
  "Aquell gos és petit i negre.",
  "La poma és vermella i dolça.",
  "El cafè és amarg.",
  "Aquesta cadira és molt vella.",
  "El llit és tou.",
  "El got és buit.",
  "El carrer és fosc.",
  // daily life
  "El gos menja carn.",
  "Els plats són a taula.",
  "El gat dorm sota la taula.",
  "Bec aigua cada dia.",
  "Mengem pa amb formatge.",
  "Els dilluns treballo molt.",
  "Em rento les mans.",
  "Vaig a l'escola a les vuit.",
  "Estudio català cada tarda.",
  "Dormo set hores.",
  // shopping and money
  "Quant costa la poma?",
  "Vull comprar tres ous.",
  "Aquest llibre és massa car.",
  "Pago amb diners.",
  "La botiga és a la dreta.",
  "Necessito sal i oli.",
  // place and direction
  "On és el bany?",
  "La cuina és petita.",
  "El parc és a prop.",
  "Visc en un poble petit.",
  "El tren arriba tard.",
  "Anem a la platja.",
  "Puja amunt, si us plau.",
  "El llibre és sobre la cadira.",
  // weather and time
  "Avui fa sol.",
  "Ahir va ploure molt.",
  "Al desembre fa molt fred.",
  "Demà anirem al mercat.",
  "A l'estiu fa calor.",
  "Ara són les tres.",
  "És dilluns.",
  // people and feelings
  "Estic molt cansat.",
  "Els nens estan contents.",
  "Tinc son.",
  "La meva germana està trista.",
  "M'agrada la música.",
  // asking
  "Qui és aquell home?",
  "Què vols menjar?",
  "Quan arriba el teu amic?",
  "Per què no menges?",
  "Com estàs?",
  "Parles català?",
  // polite
  "Hola, bon dia.",
  "Moltes gràcies.",
  "Perdó, no entenc.",
  "Adeu, fins demà.",
];

const PRS_SENTENCES = [
  // being, having, identity
  "من از کابل هستم.",
  "نام تو چیست؟",
  "پدر من معلم است.",
  "مادرم در شفاخانه کار می‌کند.",
  "این برادر من است.",
  "ما یک خانه خورد داریم.",
  "من گشنه نیستم.",
  "او دو پسر دارد.",
  "ما چهار نفر هستیم.",
  // description
  "دریا آبی است.",
  "خانه کلان بود.",
  "پشک بسیار چاق است.",
  "آن سگ خورد و سیاه است.",
  "سیب سرخ و شیرین است.",
  "چای تلخ است.",
  "این چوکی بسیار کهنه است.",
  "بستر نرم است.",
  "گیلاس خالی است.",
  "سرک تاریک است.",
  // daily life
  "سگ گوشت می‌خورد.",
  "بشقاب‌ها بالای میز است.",
  "پشک زیر میز خواب است.",
  "من هر روز آب می‌نوشم.",
  "من هر روز آب می‌خورم.",
  "ما نان و پنیر می‌خوریم.",
  "من بسیار کار می‌کنم.",
  "دستهایم را می‌شویم.",
  "من به مکتب می‌روم.",
  "هر شام درس می‌خوانم.",
  "من هفت ساعت می‌خوابم.",
  // shopping and money
  "قیمت سیب چند است؟",
  "من سه تخم می‌خرم.",
  "این کتاب بسیار قیمتی است.",
  "من با پیسه می‌پردازم.",
  "دکان طرف راست است.",
  "به نمک و روغن ضرورت دارم.",
  // place and direction
  "تشناب کجا است؟",
  "آشپزخانه خورد است.",
  "پارک نزدیک است.",
  "من در یک قریه زندگی می‌کنم.",
  "بس دیر می‌رسد.",
  "ما به بازار می‌رویم.",
  "کتاب بالای چوکی است.",
  // weather and time
  "امروز آفتاب است.",
  "دیروز باران بارید.",
  "در زمستان هوا بسیار سرد است.",
  "فردا به بازار می‌رویم.",
  "در تابستان هوا گرم است.",
  "حالا ساعت سه است.",
  "امروز جمعه است.",
  // people and feelings
  "من بسیار مانده هستم.",
  "اطفال خوش هستند.",
  "من خواب دارم.",
  "خواهرم غمگین است.",
  "من موسیقی را دوست دارم.",
  // asking
  "آن مرد کی است؟",
  "چی می‌خواهی بخوری؟",
  "دوست تو کی می‌رسد؟",
  "چرا نان نمی‌خوری؟",
  "چطور هستی؟",
  "تو دری گپ می‌زنی؟",
  // polite
  "سلام، چطور هستی؟",
  "بسیار تشکر.",
  "ببخشید، نمی‌فهمم.",
  "تا فردا.",
];

const LANGS = [
  { lang: "ca", sentences: CA_SENTENCES, tokenize: tokenizeCatalan, build: buildCa },
  { lang: "prs", sentences: PRS_SENTENCES, tokenize: tokenizeDari, build: buildPrs },
] as const;

function load(lang: string): LexiconEntry[] {
  const root = join(import.meta.dirname, "..", "..", "..", "content", lang);
  return lexiconFileSchema.parse(
    JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
  ).entries;
}

describe.each(LANGS)("$lang: a beginner can say these", ({ lang, sentences, tokenize, build }) => {
  const entries = load(lang);
  const index = build(entries);

  /**
   * Report every unreachable word in the sentence rather than the first, so one
   * run produces the whole authoring list instead of one word per test run.
   */
  function unreachable(sentence: string): string[] {
    const out: string[] = [];
    for (const token of tokenize(sentence)) {
      const entry = index.resolve(token);
      if (!entry) {
        out.push(`${token} (no entry)`);
      } else if (!isTeachable(entry)) {
        out.push(`${token} → ${entry.id} (not teachable)`);
      } else if (!entry.tags.includes(BEGINNER_CORE_TAG)) {
        out.push(`${token} → ${entry.target} (not beginner-core)`);
      }
    }
    return out;
  }

  it.each(sentences)("%s", (sentence) => {
    expect(unreachable(sentence), `unreachable in "${sentence}"`).toEqual([]);
  });
});

/**
 * Multi-word entries, asserted as whole strings.
 *
 * `خدا حافظ` and `si us plau` are single lexicon entries, so a whitespace
 * tokenizer can never reach them from inside a sentence - it asks for `حافظ`
 * and `plau`, which are not words anyone authored. Checking them here keeps the
 * requirement honest instead of quietly dropping the commonest greeting in the
 * language from the test.
 */
describe("multi-word entries resolve as phrases", () => {
  it.each([
    ["ca", ["si us plau", "bon dia", "bona nit", "per què"]],
    ["prs", ["خدا حافظ"]],
  ])("%s", (lang, phrases) => {
    const entries = load(lang);
    const index = lang === "ca" ? buildCa(entries) : buildPrs(entries);
    for (const phrase of phrases) {
      const entry = index.resolve(phrase);
      expect(entry, `${phrase} does not resolve`).toBeTruthy();
      expect(isTeachable(entry!), `${phrase} is not teachable`).toBe(true);
    }
  });
});
