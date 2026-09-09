import { describe, expect, it } from "vitest";
import { lexicon } from "../content/load.ts";
import type { LexiconEntry } from "../content/schema.ts";
import { asLexiconEntry } from "../db/user-lexemes.ts";
import type { UserLexemeRow } from "../db/types.ts";
import { profile } from "../lang/index.ts";
import { buildIndex, matchKey } from "../text/index.ts";

/**
 * The personal dictionary is fed through the same `buildIndex` the shipped
 * lexicon uses. That is the whole reason personal entries are stored in
 * LexiconEntry shape: it gets a glossed word the language's real morphology,
 * so a later inflection of it resolves without another model call.
 */

function row(over: Partial<UserLexemeRow> & { target: string }): UserLexemeRow {
  return {
    id: "ux-0a1b2c3d4e5f",
    user_id: "u",
    target_normalized: profile.text.normalize(over.target),
    translit: null,
    gloss_en: "gloss",
    pos: "noun",
    present_stem: null,
    variants: [],
    example_target: null,
    example_translit: null,
    example_en: null,
    source_text_id: null,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

describe("personal dictionary index", () => {
  it("resolves the headword it was created from", () => {
    const entry = asLexiconEntry(row({ target: "zzqqx" }));
    expect(buildIndex([entry]).resolve("zzqqx")?.id).toBe("ux-0a1b2c3d4e5f");
  });

  it("resolves a surface form recorded as a variant", () => {
    const entry = asLexiconEntry(row({ target: "zzqqx", variants: ["zzqqxes"] }));
    expect(buildIndex([entry]).resolve("zzqqxes")?.id).toBe("ux-0a1b2c3d4e5f");
  });

  /**
   * Generalisation is the payoff: tapping one form of a word must make its
   * other forms free. What the morphology generates differs per language, so
   * assert the shape rather than a specific inflection.
   */
  it("generates more surface forms than it was given", () => {
    const entry = asLexiconEntry(row({ target: "zzqqx" }));
    const index = buildIndex([entry]);
    const generated = ["zzqqxs", "zzqqxes", "zzqqxها", "zzqqxان"].filter(
      (form) => index.resolve(form)?.id === "ux-0a1b2c3d4e5f",
    );
    expect(generated.length).toBeGreaterThan(0);
  });

  it("carries the gloss and the imported tag through", () => {
    const entry = asLexiconEntry(row({ target: "zzqqx", gloss_en: "a test word" }));
    expect(entry.glossEn).toBe("a test word");
    expect(entry.tags).toContain("imported");
  });

  it("keeps ids in the ux- namespace", () => {
    expect(asLexiconEntry(row({ target: "x" })).id).toMatch(/^ux-[0-9a-f]{8,}$/);
  });

  /**
   * The safety rule. A personal entry is a model's guess at a lemma; a lexicon
   * entry is reviewed content. Resolution order is lexicon first, personal
   * second, everywhere - so even a personal entry minted for a word the lexicon
   * already has can never be what the learner sees.
   */
  it("never wins against the shipped lexicon for the same surface", () => {
    const real = lexicon.entries.find((e) => e.variants.length === 0) ?? lexicon.entries[0];
    const impostor: LexiconEntry = asLexiconEntry(row({ target: real.target }));
    const personal = buildIndex([impostor]);
    const shipped = profile.text.buildIndex(lexicon.entries);

    const resolveInOrder = (surface: string) =>
      shipped.resolve(surface) ?? personal.resolve(surface);

    expect(resolveInOrder(real.target)?.id).toBe(real.id);
    expect(matchKey(impostor.targetNormalized)).toBe(matchKey(real.targetNormalized));
  });
});
