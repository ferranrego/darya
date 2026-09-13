import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LexiconEntry } from "../../content/schema.ts";
import { conjugationSurfaces, derivePastStem, VERB_OVERRIDES } from "./conjugate.ts";
import { buildLexiconIndex } from "./lexicon-index.ts";
import { matchKey, ZWNJ } from "./normalize.ts";

function entry(partial: Partial<LexiconEntry> & { id: string; target: string }): LexiconEntry {
  return {
    targetNormalized: partial.target,
    translit: "x",
    glossEn: "x",
    pos: "noun",
    freqRank: 1,
    freqBand: 1,
    register: "neutral",
    variants: [],
    exampleTarget: "x",
    exampleTranslit: "x",
    exampleEn: "x",
    tags: [],
    ...partial,
  } as LexiconEntry;
}

describe("resolve precedence (synthetic)", () => {
  it("an authored headword beats a generated conjugation on the same key", () => {
    // درد (pain, noun) collides with در+د, a subjunctive parse of دریدن's stem.
    const pain = entry({ id: "lx-0001", target: "درد", pos: "noun", freqRank: 1 });
    const daridan = entry({
      id: "lx-0002",
      target: "دریدن",
      pos: "verb",
      freqRank: 2,
      presentStem: "در",
    });
    const idx = buildLexiconIndex([pain, daridan]);
    expect(idx.resolve("درد")?.id).toBe("lx-0001");
    expect(idx.resolve(`می${ZWNJ}درد`)?.id).toBe("lx-0002");
  });

  it("earlier (more frequent) verbs win contested conjugation keys", () => {
    // خفتن (stem خواب) generates می‌خوابم, same as خوابیدن's paradigm.
    const khabidan = entry({ id: "lx-0001", target: "خوابیدن", pos: "verb", freqRank: 1, presentStem: "خواب" });
    const khoftan = entry({ id: "lx-0002", target: "خفتن", pos: "verb", freqRank: 2, presentStem: "خواب" });
    const idx = buildLexiconIndex([khabidan, khoftan]);
    expect(idx.resolve(`می${ZWNJ}خوابم`)?.id).toBe("lx-0001");
    expect(idx.resolve("خفتم")?.id).toBe("lx-0002"); // uncontested past stays put
  });

  it("compound carrier conjugates its light verb only when no simple entry owns it", () => {
    const carrier = entry({
      id: "lx-0001",
      target: "خجالت کشیدن",
      pos: "verb",
      freqRank: 1,
      presentStem: "کش",
    });
    const idx = buildLexiconIndex([carrier]);
    expect(idx.resolve(`می${ZWNJ}کشم`)?.id).toBe("lx-0001");
    expect(idx.resolve("کشیدم")?.id).toBe("lx-0001");
  });
});

describe("resolve against the real lexicon", () => {
  const file = JSON.parse(
    readFileSync(join(import.meta.dirname, "../../../../content/prs/lexicon/lexicon.json"), "utf8")
  );
  const entries: LexiconEntry[] = file.entries;
  const idx = buildLexiconIndex(entries);

  const cases: Array<[string, string]> = [
    ["کرده‌ام", "کردن"], // present perfect - the original bug
    ["کرده", "کردن"], // bare participle
    ["نمی‌روم", "رفتن"], // negative present
    ["میروم", "رفتن"], // ZWNJ-less spelling
    ["بخوانید", "خواندن"], // imperative
    ["دیده‌اند", "دیدن"], // perfect 3pl
    ["دیدمش", "دیدن"], // object enclitic over a conjugated form
    ["نیامده‌اند", "آمدن"], // negative perfect with آ mutation
    ["برمی‌خیزد", "برخاستن"], // separable prefix verb
    ["نفهمیدم", "فهمیدن"], // negative past, long-tail verb
    ["بخرم", "خریدن"], // subjunctive, long-tail verb
    ["می‌بارد", "باریدن"], // present 3sg
    ["خواهم", "خواستن"], // future auxiliary resolves via variants/conjugations

    // می‌کنم used to be its own headword glossed "I do (present)", which
    // outranked the generated conjugation and shadowed کردن - while می‌کند
    // resolved correctly. Assert both, since the inconsistency was the symptom.
    ["می‌کنم", "کردن"],
    ["می‌کند", "کردن"],

    // Suppletive budan: not derivable from any stem pair, so authored in
    // SUPPLETIVE_FORMS. The subjunctive was entirely unresolvable before.
    ["باشم", "بودن"],
    ["نباشند", "بودن"],
    ["هست", "بودن"],
    ["می‌توان", "توانستن"], // impersonal, no personal ending

    // Stacked suffixes (plural underneath an ezafe or possessive enclitic) -
    // resolve() used to strip only one suffix layer and then do an exact
    // lookup on what was left, so a plural root like میوه‌ها or دوستان (which
    // is itself only reachable by stripping its own plural suffix) never got
    // a second pass and the whole surface fell through to null.
    ["میوه‌های", "میوه"], // plural میوه‌ها + ezafe ی
    ["دکان‌های", "دکان"], // plural دکان‌ها + ezafe ی
    ["دوستانش", "دوست"], // plural دوستان + possessive ش
    ["خانه‌هایش", "خانه"], // three layers: plural ها + ezafه ی + possessive ش -
    // "کتاب‌هایم" resolved before this fix only because "یم" is its own entry
    // in the suffix list, consuming ezafه+possessive together by coincidence.
    // A possessive other than م (ش here) exposes that the general case - an
    // ezafه sitting between the plural and the outer suffix - was unhandled.
  ];
  it.each(cases)("%s → %s", (surface, infinitive) => {
    expect(idx.resolve(surface)?.target).toBe(infinitive);
  });

  it("does not hijack nouns: خانه‌ام → خانه", () => {
    expect(idx.resolve("خانه‌ام")?.target).toBe("خانه");
  });

  // The full possessive set, not just -am. خانه‌ام resolved while خانه‌ات,
  // خانه‌تان and کتابتان did not, so a learner tapping "your house" in the
  // reader was told it was a name. Both spellings: after a silent-h noun the
  // enclitic follows a ZWNJ and takes an alef (-at, -ash); after a consonant
  // it attaches directly. The plural persons (-mān, -tān, -shān) had no
  // suffix at all in the stemmer.
  const possessives: Array<[string, string]> = [
    ...["ام", "ات", "اش", "مان", "تان", "شان"].map((s): [string, string] => [`خانه${ZWNJ}${s}`, "خانه"]),
    ...["م", "ت", "ش", "مان", "تان", "شان"].map((s): [string, string] => [`کتاب${s}`, "کتاب"]),
    ["دوستتان", "دوست"], // a ت-final noun under -tān
    ["دوستانشان", "دوست"], // plural underneath a plural possessive
    ["نامه‌هایتان", "نامه"], // plural + ezafe glide + -tān
    ["لباستان", "لباس"], // a س-final noun: -tān here is not the place suffix -stān
    ["خودتان", "خود"], // pronoun
    ["همه‌شان", "همه"], // determiner
  ];
  it.each(possessives)("possessive %s → %s", (surface, headword) => {
    expect(idx.resolve(surface)?.target).toBe(headword);
  });

  // The direction the fix could break: words that merely END in the new
  // suffixes, or begin with ن, must keep their own entry and must not be
  // peeled into a different one (مهمان → مه "fog", پریشان → پری, نان → ان).
  const ownEntry = [
    "دوست", "درست", "خوش", "نان", "نام", "نه",
    "مهمان", "سازمان", "زمان", "داستان", "پریشان", "نشان", "ایشان",
  ];
  it.each(ownEntry)("%s keeps resolving to its own entry", (word) => {
    expect(idx.resolve(word)?.targetNormalized).toBe(word);
  });

  it("does not split a -stān word the lexicon lacks into an adverb or verb stem", () => {
    // Both are in lexicon example sentences (سرطان پستان, بوستان سعدی) and
    // resolved to پس "then" and بوسیدن "to kiss" on the first cut of this fix.
    expect(idx.resolve("پستان")).toBeNull();
    expect(idx.resolve("بوستان")).toBeNull();
  });

  it("does not peel a bare -āt or -āsh without the ZWNJ", () => {
    // امکانات "facilities" is not in the lexicon but امکان "possibility" is:
    // an Arabic -āt plural, not "your امکان", and not the same word to a
    // learner. Only the ZWNJ spelling marks -āt/-āsh as an enclitic.
    expect(idx.resolve("امکانات")).toBeNull();
    expect(idx.resolve("کتاباش")).toBeNull();
    expect(idx.resolve(`کتاب${ZWNJ}اش`)?.target).toBe("کتاب");
  });

  it("every headword ending in ت, ش, مان, تان or شان still resolves to itself", () => {
    const tails = entries.filter((e) => /(ت|ش|مان|تان|شان)$/.test(e.targetNormalized));
    expect(tails.length).toBeGreaterThan(300);
    for (const e of tails) {
      expect(idx.resolve(e.targetNormalized)?.targetNormalized, e.targetNormalized).toBe(e.targetNormalized);
    }
  });

  // Negation. باید is a modal, not an infinitive, so the paradigm generator
  // never produced its negative - نباید ("must not") was unresolvable while
  // every generated verb's ن- form resolved. Assert both kinds together.
  const negated: Array<[string, string]> = [
    ["نباید", "باید"],
    ["نمی‌خورم", "خوردن"],
    ["نرفتم", "رفتن"],
    ["نکردم", "کردن"],
    ["نخواهم", "خواستن"],
    ["نیست", "بودن"],
    ["نباشد", "بودن"],
    ["نمی‌توان", "توانستن"],
  ];
  it.each(negated)("negated %s → %s", (surface, headword) => {
    expect(idx.resolve(surface)?.target).toBe(headword);
  });

  it("still returns null for actual names", () => {
    expect(idx.resolve("فرشته‌جان")).toBeNull();
  });

  it("rejects the malformed forms the deleted scraper accepted", () => {
    // buildAllowedFormKeys derived stems from می‌-variants and mis-stripped the
    // 3sg ـد as the 3pl ـند on ن-final stems, so می‌کند yielded "ک" and می‌بیند
    // yielded "بی". ~240 forms like these were whitelisted as valid Dari that
    // the AI was free to put in front of learners.
    for (const bogus of ["می‌کم", "می‌بیم", "ببیم", "نکی", "می‌زم", "می‌مام"]) {
      expect(idx.resolve(bogus), bogus).toBeNull();
    }
  });

  it("every verb with a presentStem round-trips its core generated forms", () => {
    const verbs = entries.filter(
      (e) => e.pos === "verb" && e.presentStem && !e.targetNormalized.includes(" ")
    );
    expect(verbs.length).toBeGreaterThan(100);
    let sameId = 0;
    for (const v of verbs) {
      const override = VERB_OVERRIDES[matchKey(v.targetNormalized)];
      const pastStem = derivePastStem(v.targetNormalized)!;
      const surfaces = conjugationSurfaces({
        pastStem: override?.prefix ? pastStem.slice(override.prefix.length) : pastStem,
        presentStem: override?.presentStem ?? v.presentStem ?? null,
        prefix: override?.prefix,
        noMiPresent: override?.noMiPresent,
      });
      let allSame = true;
      for (const s of surfaces) {
        const hit = idx.resolve(s);
        // Every generated form must resolve to SOME entry (homographs may
        // legitimately claim a key), never fall through to null.
        expect(hit, `${v.target}: ${s}`).not.toBeNull();
        if (hit!.id !== v.id) allSame = false;
      }
      if (allSame) sameId++;
    }
    // ~74% of verbs own every single generated form; the rest lose a handful
    // of keys to authored homographs (روند/بینی/شکست/کشتی/شاید…) or
    // higher-frequency verbs - correct precedence, not a defect.
    expect(sameId / verbs.length).toBeGreaterThan(0.7);
  });
});
