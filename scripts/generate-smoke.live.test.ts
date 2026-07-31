import { describe, expect, it } from "vitest";
/**
 * Opt-in live check of the core loop: prompt -> AI provider -> generated text
 * -> OOV verification against the lexicon. Hits the real provider and spends
 * quota, so it is NOT part of `pnpm test`.
 *
 *   set -a; . .env.ca.local; set +a
 *   NEXT_PUBLIC_TARGET_LANG=ca pnpm exec vitest run scripts/generate-smoke.test.ts
 */
import { generateText } from "../src/lib/ai/generate.ts";
import { levels, lexicon } from "../src/lib/content/load.ts";
import { profile } from "../src/lib/lang/index.ts";

describe("core loop: generate a text in the active language", () => {
  it("produces a level-appropriate text with no foreign script", { timeout: 120_000 }, async () => {
    const level = levels[0];
    const band1 = lexicon.entries.filter((e) => e.freqBand === 1);
    const knownWords = band1.slice(0, 60);
    const doc = await generateText({
      level,
      knownWords,
      knownIds: new Set(knownWords.map((e) => e.id)),
      targetWords: band1.slice(60, 63),
      newWordRatio: 0.05,
    });

    console.log(`\n${doc.titleTarget} - ${doc.titleEn}`);
    for (const s of doc.sentences) {
      const resolved = s.tokens.filter((t) => t.lexemeId).length;
      console.log(`  ${s.target}\n     ${s.en}  [${resolved}/${s.tokens.length}]`);
    }

    expect(doc.sentences.length).toBeGreaterThan(0);

    // "Foreign" depends on the language under test. This asserted "no
    // Perso-Arabic" unconditionally, which is right for Catalan and precisely
    // backwards for Dari - it passed only because the file was excluded from
    // every run, so nobody had executed it against Dari.
    //
    // The failure it is really guarding is script bleed: the model drifting
    // into the other language's alphabet mid-text. So each language forbids the
    // script it should never contain. Transliteration lives in `translit`, not
    // `target`, so Latin letters in a Dari sentence are a genuine defect.
    const PERSO_ARABIC = /[؀-ۿ]/;
    const LATIN = /[a-z]/i;
    const forbidden = profile.capabilities.transliteration ? LATIN : PERSO_ARABIC;
    for (const s of doc.sentences) {
      expect(forbidden.test(s.target), `foreign script in "${s.target}"`).toBe(false);
    }
    if (profile.code === "ca") {
      expect(doc.sentences.some((s) => /[a-zàèéíòóúïüç]/i.test(s.target))).toBe(true);
    }
  });
});
