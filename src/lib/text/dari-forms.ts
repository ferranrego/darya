import type { LexiconEntry } from "../content/schema.ts";
import { matchKey, normalizeDari, ZWNJ } from "./normalize.ts";

/**
 * Inflected Dari verb forms the grammar course uses but the lexicon does not
 * resolve on its own. The lexicon lists common conjugations as `variants`
 * (می‌روم، رفتم…) but not full paradigms, and never the subjunctive, participle
 * or perfect forms that A2/B1/B2 teach. We derive a present stem from each
 * verb's می‌-variants and a past stem from its infinitive, then generate:
 *   - present + negative present (mē- / namē-)      [A1]
 *   - simple past + negative past                    [A1]
 *   - subjunctive / imperative (be- / na-)           [A2]
 *   - past participle + perfect enclitics            [A2/B1]
 *   - khāhad future                                  [B1]
 * plus budan ("to be") paradigms. A sentence token is acceptable when it
 * resolves in the lexicon OR its match key is in the set this returns.
 */

const PRESENT_ENDINGS = ["م", "ی", "د", "یم", "ید", "ند"];
const PAST_ENDINGS = ["م", "ی", "", "یم", "ید", "ند"];
/** Perfect enclitics attach to the participle with a ZWNJ (رفته‌ام). 3sg is the
 * two-word "رفته است", handled by the participle + budan forms below. */
const PERFECT_ENCLITICS = ["ام", "ای", "ایم", "اید", "اند"];

/** budan/hastan/dāshtan forms, and khāhad future - not derivable from variants. */
const IRREGULAR_FORMS = [
  // present / negative present of budan (existential + copula)
  "هستم", "هستی", "هست", "است", "هستیم", "هستید", "هستند",
  "نیستم", "نیستی", "نیست", "نیستیم", "نیستید", "نیستند",
  // simple past of budan
  "بودم", "بودی", "بود", "بودیم", "بودید", "بودند",
  "نبودم", "نبودی", "نبود", "نبودیم", "نبودید", "نبودند",
  // subjunctive of budan (bāsham…) - used in past subjunctive "رفته باشم"
  "باشم", "باشی", "باشد", "باشیم", "باشید", "باشند",
  "نباشم", "نباشی", "نباشد", "نباشیم", "نباشید", "نباشند",
  // participle + perfect of budan
  "بوده", `بوده${ZWNJ}ام`, `بوده${ZWNJ}ای`, `بوده${ZWNJ}ایم`, `بوده${ZWNJ}اید`, `بوده${ZWNJ}اند`,
  // dāshtan negates without mē- (nadāram)
  "ندارم", "نداری", "ندارد", "نداریم", "ندارید", "ندارند",
  // khāhad future (formal) + negative
  "خواهم", "خواهی", "خواهد", "خواهیم", "خواهید", "خواهند",
  "نخواهم", "نخواهی", "نخواهد", "نخواهیم", "نخواهید", "نخواهند",
  // āmadan is irregular in the subjunctive/imperative (biā, not *beāy)
  "بیا", "بیایید", "بیایم", "بیایی", "بیاید", "بیاییم", "بیایند",
  "نیا", "نیایید", "نیایم", "نیایی", "نیاید", "نیاییم", "نیایند",
  // impersonal mētawān ("one can") + short infinitive - a fixed form with no
  // personal ending, so the derived توان- paradigm doesn't cover it.
  `می${ZWNJ}توان`, `نمی${ZWNJ}توان`,
];

const ME_PREFIX = `می${ZWNJ}`;

export function buildAllowedFormKeys(entries: LexiconEntry[]): Set<string> {
  const keys = new Set<string>();
  const add = (form: string) => keys.add(matchKey(form));
  for (const form of IRREGULAR_FORMS) add(form);

  const addParadigm = (stem: string, endings: string[], prefix = "") => {
    for (const ending of endings) add(`${prefix}${stem}${ending}`);
  };

  for (const entry of entries) {
    if (entry.pos !== "verb") continue;

    // Present stems from می‌-variants: strip the prefix and the longest
    // matching personal ending (یم before م, etc.).
    for (const surface of entry.variants) {
      const norm = normalizeDari(surface);
      if (!norm.startsWith(ME_PREFIX)) continue;
      const rest = norm.slice(ME_PREFIX.length);
      const ending = ["یم", "ید", "ند", "م", "ی", "د"].find((e) => rest.endsWith(e));
      if (!ending || rest.length <= ending.length) continue;
      const stem = rest.slice(0, -ending.length);

      // Present + negative present.
      addParadigm(stem, PRESENT_ENDINGS, ME_PREFIX);
      addParadigm(stem, PRESENT_ENDINGS, `ن${ME_PREFIX}`);

      // Subjunctive / imperative with be-/na-. Vowel-initial stems (آ / ا)
      // take an irregular prefix (بیا for āmadan), hardcoded above - skip them.
      if (!/^[آا]/.test(stem)) {
        addParadigm(stem, PRESENT_ENDINGS, "ب");
        add(`ب${stem}`); // bare imperative (برو)
        addParadigm(stem, PRESENT_ENDINGS, "ن");
        add(`ن${stem}`); // negative imperative (نرو)
      }
    }

    // Past stem = infinitive minus final ن (رفتن → رفت). آ-initial verbs stay
    // regular in the past (آمد), so only the be-/na- present is special-cased.
    const inf = entry.dariNormalized;
    if (inf.endsWith("ن") && inf.length > 2) {
      const pastStem = inf.slice(0, -1);

      // Simple past + negative past.
      addParadigm(pastStem, PAST_ENDINGS);
      addParadigm(pastStem, PAST_ENDINGS, "ن");

      // Past participle (رفته) + perfect enclitics (رفته‌ام) + negatives.
      const participle = `${pastStem}ه`;
      add(participle);
      add(`ن${participle}`);
      for (const enc of PERFECT_ENCLITICS) {
        add(`${participle}${ZWNJ}${enc}`);
        add(`ن${participle}${ZWNJ}${enc}`);
      }
    }
  }
  return keys;
}
