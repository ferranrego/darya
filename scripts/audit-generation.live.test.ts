/**
 * Generate real texts and measure them, so changes to the reading pipeline can
 * be judged on output rather than on intent.
 *
 * The reader's quality lives in numbers no unit test can produce - what share
 * of running words a learner already knows, how many new words a text actually
 * introduces, whether those new words are all nouns. This hits the live provider
 * chain, so it spends free-tier quota and is not part of `pnpm test`.
 *
 * Usage:
 *   set -a; . ./.env.ca.local; set +a
 *   LIVE_AI=1 NEXT_PUBLIC_TARGET_LANG=ca AUDIT_PER_LEVEL=2 \
 *     pnpm exec vitest run scripts/audit-generation.live.test.ts
 *
 * AUDIT_LEVEL=L3 restricts it to one level.
 */

import { describe, expect, it } from "vitest";

import { generateText } from "../src/lib/ai/generate.ts";
import { levels, lexicon } from "../src/lib/content/load.ts";
import { profile } from "../src/lib/lang/index.ts";
import { buildIndex, tokenize } from "../src/lib/text/index.ts";

const index = buildIndex(lexicon.entries);

interface Row {
  level: string;
  ok: boolean;
  tokenCoverage: number;
  untaughtTypes: number;
  newWordsUsed: number;
  newWordsAsked: number;
  posMix: string;
  title: string;
  note?: string;
}

async function audit() {
  const perLevel = Number(process.env.AUDIT_PER_LEVEL ?? 1);
  const wanted = process.env.AUDIT_LEVEL || null;
  const rows: Row[] = [];

  for (const level of levels) {
    if (wanted && level.id !== wanted) continue;

    // Mirror what the route does: everything at or below the level's entry rank
    // counts as known, and new words come from the level's own bands.
    const known = lexicon.entries.filter((e) => e.freqRank <= level.entryKnownWords);
    const inBand = lexicon.entries.filter((e) => level.freqBands.includes(e.freqBand));
    const candidates = inBand
      .filter((e) => e.freqRank > level.entryKnownWords)
      .sort((a, b) => a.freqRank - b.freqRank);

    const expectedTokens =
      ((level.sentenceRange[0] + level.sentenceRange[1]) / 2) * level.avgSentenceWords;
    const targetCount = Math.max(2, Math.min(15, Math.round(expectedTokens * 0.05)));

    for (let n = 0; n < perLevel; n++) {
      const targetWords = candidates.slice(n * targetCount, (n + 1) * targetCount);
      const knownWords = known.length >= 40 ? known : inBand.slice(0, 60);
      const allowed = new Set([...knownWords, ...targetWords].map((w) => w.id));
      const targetIds = new Set(targetWords.map((w) => w.id));

      try {
        const doc = await generateText({
          level,
          knownWords: knownWords.slice(0, 160),
          targetWords,
          newWordRatio: 0.05,
        });

        let total = 0;
        let covered = 0;
        const untaught = new Set<string>();
        const usedNew = new Set<string>();
        for (const s of doc.sentences) {
          for (const surface of tokenize(s.target)) {
            total++;
            const e = index.resolve(surface);
            if (e && allowed.has(e.id)) covered++;
            else if (e) untaught.add(e.id);
            else untaught.add(surface);
            if (e && targetIds.has(e.id)) usedNew.add(e.id);
          }
        }
        const posCount: Record<string, number> = {};
        for (const w of targetWords) posCount[w.pos] = (posCount[w.pos] ?? 0) + 1;

        rows.push({
          level: level.id,
          ok: true,
          tokenCoverage: total ? covered / total : 0,
          untaughtTypes: untaught.size,
          newWordsUsed: usedNew.size,
          newWordsAsked: targetWords.length,
          posMix: Object.entries(posCount)
            .map(([p, c]) => `${p.slice(0, 4)}:${c}`)
            .join(" "),
          title: doc.titleTarget,
        });
        console.log(`\n── ${level.id} · ${doc.titleTarget} — ${doc.titleEn}`);
        for (const s of doc.sentences) console.log(`   ${s.target}\n     ${s.en}`);
      } catch (e) {
        rows.push({
          level: level.id,
          ok: false,
          tokenCoverage: 0,
          untaughtTypes: 0,
          newWordsUsed: 0,
          newWordsAsked: targetWords.length,
          posMix: "",
          title: "",
          note: e instanceof Error ? e.message.slice(0, 120) : String(e),
        });
        console.log(`\n── ${level.id} FAILED: ${e instanceof Error ? e.message.slice(0, 200) : e}`);
      }
    }
  }

  console.log(`\n\n=== ${profile.code} generation audit ===`);
  console.log("level  ok   tokenCov  untaught  new used/asked  new-word POS mix");
  for (const r of rows) {
    console.log(
      `${r.level.padEnd(6)} ${r.ok ? "y " : "N "}  ` +
        `${(r.tokenCoverage * 100).toFixed(1).padStart(6)}%  ` +
        `${String(r.untaughtTypes).padStart(8)}  ` +
        `${String(r.newWordsUsed).padStart(8)}/${r.newWordsAsked}  ${r.posMix}` +
        (r.note ? `  ${r.note}` : ""),
    );
  }
  const good = rows.filter((r) => r.ok);
  if (good.length) {
    const mean = good.reduce((n, r) => n + r.tokenCoverage, 0) / good.length;
    console.log(
      `\n${good.length}/${rows.length} generated; mean token coverage ${(mean * 100).toFixed(1)}% ` +
        `(target 95%)`,
    );
  }
  return rows;
}

describe("generation audit (live provider)", () => {
  it(
    "generates a text at every level and reports its measurements",
    { timeout: 900_000 },
    async () => {
      const rows = await audit();
      // The report is the point; the only hard assertion is that the pipeline
      // still produces something at all, so a total outage fails loudly.
      expect(rows.some((r) => r.ok)).toBe(true);
    },
  );
});
