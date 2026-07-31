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
import { selectKnown, selectTargets, targetCountFor } from "../src/lib/content/word-selection.ts";
import { MAX_OOV_TOKEN_RATE } from "../src/lib/content/difficulty.ts";
import { profile } from "../src/lib/lang/index.ts";
import { buildIndex, tokenize } from "../src/lib/text/index.ts";

const index = buildIndex(lexicon.entries);

interface Row {
  level: string;
  cefrHint: string;
  ok: boolean;
  tokenCoverage: number;
  untaughtTypes: number;
  newWordsUsed: number;
  newWordsAsked: number;
  /** Parts of speech of the requested new words, one entry per word. */
  posList: string[];
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

    // Call the same selection the route calls. This used to re-implement it,
    // which is how the audit could report healthy texts while the route was
    // building its prompt from a different vocabulary entirely.
    const known = lexicon.entries.filter((e) => e.freqRank <= level.entryKnownWords);
    const inBand = lexicon.entries.filter((e) => level.freqBands.includes(e.freqBand));
    const candidates = inBand.filter((e) => e.freqRank > level.entryKnownWords);
    const targetCount = targetCountFor(level, 0.05);

    for (let n = 0; n < perLevel; n++) {
      const effectiveKnown = known.length >= 40 ? known : inBand.slice(0, 60);
      // Seeded per run so consecutive texts at one level differ but the audit
      // stays reproducible.
      const targetWords = selectTargets({ candidates, count: targetCount, seed: n + 1 });
      const knownIds = new Set([...known.map((e) => e.id), ...effectiveKnown.map((e) => e.id)]);
      const allowed = new Set<string>([...knownIds, ...targetWords.map((w) => w.id)]);
      const targetIds = new Set(targetWords.map((w) => w.id));

      try {
        const doc = await generateText({
          level,
          knownWords: selectKnown({ known: effectiveKnown, level }),
          knownIds,
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
          cefrHint: level.cefrHint,
          ok: true,
          tokenCoverage: total ? covered / total : 0,
          untaughtTypes: untaught.size,
          newWordsUsed: usedNew.size,
          newWordsAsked: targetWords.length,
          posList: targetWords.map((w) => w.pos),
          posMix: Object.entries(posCount)
            .map(([p, c]) => `${p.slice(0, 4)}:${c}`)
            .join(" "),
          title: doc.titleTarget,
        });
        console.log(`\n── ${level.id} · ${doc.titleTarget} - ${doc.titleEn}`);
        for (const s of doc.sentences) console.log(`   ${s.target}\n     ${s.en}`);
      } catch (e) {
        rows.push({
          level: level.id,
          cefrHint: level.cefrHint,
          ok: false,
          tokenCoverage: 0,
          untaughtTypes: 0,
          newWordsUsed: 0,
          newWordsAsked: targetWords.length,
          posList: [],
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

/**
 * Levels up to and including B2 are held to the thresholds; C1 and C2 stay
 * reporting-only, because the upper levels are limited by how much vocabulary
 * the lexicon has rather than by the pipeline, and failing on that would be
 * failing on a known content gap on every run.
 */
const GATED_CEFR = new Set(["pre-A1", "A1", "A2", "A2+", "B1", "B2"]);

describe("generation audit (live provider)", () => {
  it(
    "generates a usable text at every level up to B2",
    { timeout: 900_000 },
    async () => {
      const rows = await audit();
      expect(rows.length, "no levels were audited").toBeGreaterThan(0);

      const gated = rows.filter((r) => GATED_CEFR.has(r.cefrHint));
      for (const r of gated) {
        const where = `${r.level} (${r.cefrHint})`;
        expect(r.ok, `${where} failed to generate: ${r.note ?? ""}`).toBe(true);

        // Comprehensible input needs the learner to already know almost every
        // running word; below this they are decoding, not acquiring.
        expect(
          r.tokenCoverage,
          `${where} token coverage ${(r.tokenCoverage * 100).toFixed(1)}%`,
        ).toBeGreaterThanOrEqual(1 - MAX_OOV_TOKEN_RATE);

        // The failure this audit exists to catch: a fluent, level-correct text
        // that teaches none of the words it was written for.
        expect(
          r.newWordsUsed / Math.max(1, r.newWordsAsked),
          `${where} taught ${r.newWordsUsed} of ${r.newWordsAsked} requested words`,
        ).toBeGreaterThanOrEqual(0.5);

        // Both lexicons are ~three-quarters nouns, so an unquota'd selection is
        // all nouns and the level's verb and adjective morphology never appears.
        expect(
          new Set(r.posList).size,
          `${where} new words are all ${r.posList[0] ?? "?"}`,
        ).toBeGreaterThanOrEqual(2);
      }
    },
  );
});
