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
    const doc = await generateText({
      level,
      knownWords: band1.slice(0, 60),
      targetWords: band1.slice(60, 63),
      newWordRatio: 0.05,
    });

    console.log(`\n${doc.titleTarget} — ${doc.titleEn}`);
    for (const s of doc.sentences) {
      const resolved = s.tokens.filter((t) => t.lexemeId).length;
      console.log(`  ${s.target}\n     ${s.en}  [${resolved}/${s.tokens.length}]`);
    }

    expect(doc.sentences.length).toBeGreaterThan(0);
    const PERSO_ARABIC = /[؀-ۿ]/;
    for (const s of doc.sentences) {
      expect(PERSO_ARABIC.test(s.target), `foreign script in "${s.target}"`).toBe(false);
    }
    if (profile.code === "ca") {
      expect(doc.sentences.some((s) => /[a-zàèéíòóúïüç]/i.test(s.target))).toBe(true);
    }
  });
});
