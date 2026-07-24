import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { LexiconEntry } from "../content/schema.ts";
import { conjugationSurfaces, derivePastStem, VERB_OVERRIDES } from "./conjugate.ts";
import { buildLexiconIndex } from "./lexicon-index.ts";
import { matchKey, ZWNJ } from "./normalize.ts";

function entry(partial: Partial<LexiconEntry> & { id: string; dari: string }): LexiconEntry {
  return {
    dariNormalized: partial.dari,
    translit: "x",
    glossEn: "x",
    pos: "noun",
    freqRank: 1,
    freqBand: 1,
    register: "neutral",
    variants: [],
    exampleDari: "x",
    exampleTranslit: "x",
    exampleEn: "x",
    tags: [],
    ...partial,
  } as LexiconEntry;
}

describe("resolve precedence (synthetic)", () => {
  it("an authored headword beats a generated conjugation on the same key", () => {
    // درد (pain, noun) collides with در+د, a subjunctive parse of دریدن's stem.
    const pain = entry({ id: "lx-0001", dari: "درد", pos: "noun", freqRank: 1 });
    const daridan = entry({
      id: "lx-0002",
      dari: "دریدن",
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
    const khabidan = entry({ id: "lx-0001", dari: "خوابیدن", pos: "verb", freqRank: 1, presentStem: "خواب" });
    const khoftan = entry({ id: "lx-0002", dari: "خفتن", pos: "verb", freqRank: 2, presentStem: "خواب" });
    const idx = buildLexiconIndex([khabidan, khoftan]);
    expect(idx.resolve(`می${ZWNJ}خوابم`)?.id).toBe("lx-0001");
    expect(idx.resolve("خفتم")?.id).toBe("lx-0002"); // uncontested past stays put
  });

  it("compound carrier conjugates its light verb only when no simple entry owns it", () => {
    const carrier = entry({
      id: "lx-0001",
      dari: "خجالت کشیدن",
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
    readFileSync(join(import.meta.dirname, "../../../content/lexicon/lexicon.json"), "utf8")
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
  ];
  it.each(cases)("%s → %s", (surface, infinitive) => {
    expect(idx.resolve(surface)?.dari).toBe(infinitive);
  });

  it("does not hijack nouns: خانه‌ام → خانه", () => {
    expect(idx.resolve("خانه‌ام")?.dari).toBe("خانه");
  });

  it("still returns null for actual names", () => {
    expect(idx.resolve("فرشته‌جان")).toBeNull();
  });

  it("every verb with a presentStem round-trips its core generated forms", () => {
    const verbs = entries.filter(
      (e) => e.pos === "verb" && e.presentStem && !e.dariNormalized.includes(" ")
    );
    expect(verbs.length).toBeGreaterThan(100);
    let sameId = 0;
    for (const v of verbs) {
      const override = VERB_OVERRIDES[matchKey(v.dariNormalized)];
      const pastStem = derivePastStem(v.dariNormalized)!;
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
        expect(hit, `${v.dari}: ${s}`).not.toBeNull();
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
