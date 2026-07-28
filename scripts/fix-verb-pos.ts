/**
 * One-off content correction: fix `pos` mis-tagging on verb entries and the
 * compound spellings that defeat compound detection.
 *
 * Why: `validate-content.ts` had no POS checks, so a contiguous freqRank block
 * (1092-1132) of adverbs shipped tagged as `pos: "verb"` - evidently one bad
 * generation batch - along with six Arabic verbal nouns and one Pashto word.
 * That is not cosmetic: `pos === "verb"` colours the word red in the reader
 * (text-reader.tsx), changes the word sheet, and makes the SRS present the card
 * in isolation with no context sentence (review/page.tsx) - exactly wrong for
 * an adverb.
 *
 * Three kinds of change, all deterministic and listed explicitly so the diff
 * can be audited:
 *   1. Arabic tanwin (ً) ending  → adverb. Purely mechanical, 27 entries.
 *   2. Hand-classified remainder → adverb / phrase / noun. Multi-word
 *      adverbials become `phrase`, matching the 32 entries already tagged that
 *      way (بدون شک، به طور کلی، به هر حال).
 *   3. Compounds written without a space (استخدام‌کردن) → spaced, so the
 *      `includes(" ")` compound test in lexicon-index.ts sees them and their
 *      light verb conjugates them.
 *
 * Deletions (lx-0286 می‌کنم, lx-0760 گډول) are NOT done here - they need the
 * accompanying SQL migration to merge user SRS history first. See the migration
 * in supabase/migrations/.
 *
 * Reads/writes raw JSON - never through zod, which would reorder or inject.
 *
 * Run: node scripts/fix-verb-pos.ts [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeDari } from "../src/lib/text/normalize.ts";

const dryRun = process.argv.includes("--dry-run");
const lexiconPath = join(import.meta.dirname, "..", "content", "lexicon", "lexicon.json");

/** Hand-classified. Single-word adverbials → adverb; multi-word → phrase. */
const POS_FIXES: Record<string, string> = {
  "lx-1096": "adverb", // گاهی sometimes
  "lx-1104": "adverb", // غیرمستقیم indirectly
  "lx-1106": "adverb", // بالاخره finally
  "lx-1109": "adverb", // همزمان simultaneously
  "lx-1115": "adverb", // مخفیانه secretly
  "lx-1116": "adverb", // آشکارا openly
  "lx-1117": "adverb", // خوشبختانه fortunately
  "lx-1118": "adverb", // متأسفانه unfortunately
  "lx-1131": "adverb", // جداگانه separately

  "lx-1105": "phrase", // به زودی soon
  "lx-1107": "phrase", // در نهایت eventually
  "lx-1108": "phrase", // در حال حاضر currently
  "lx-1129": "phrase", // به تنهایی alone
  "lx-1130": "phrase", // با هم together

  // Arabic verbal nouns. In Dari the verb is the compound (بازداشت کردن);
  // the bare noun is a noun, however the English gloss reads.
  "lx-1423": "noun", // بازداشت arrest
  "lx-1461": "noun", // غصب usurp
  "lx-1468": "noun", // تصویب approve
  "lx-1469": "noun", // توشیح endorse
  "lx-1470": "noun", // تعدیل amend
  "lx-1477": "noun", // احضار summon
};

/**
 * Compounds written without the separating space.
 *
 * lx-5234 (انکارکردن) is deliberately absent: respacing it to انکار کردن
 * collides with lx-0928, which is the same verb at freqRank 928. The solid
 * spelling had been hiding a duplicate entry. It is deleted and merged into
 * lx-0928 by the accompanying migration instead.
 */
const SPLIT_COMPOUNDS: Record<string, string> = {
  "lx-1249": "استخدام کردن", // was استخدام‌کردن (ZWNJ)
  "lx-1252": "امضا کردن", //    was امضاکردن (solid)
  "lx-1781": "خون دادن", //     was خون‌دادن (ZWNJ)
  "lx-3208": "شرطی شدن", //     was شرطی‌شدن (ZWNJ)
};

/** Verb entries that are legitimately not infinitives - left alone. */
const EXEMPT = new Set(["lx-0010", "lx-0287", "lx-0290"]); // است، باشد، باید

const TANWIN = /ً/;
const INFINITIVE = /(دن|تن)$/;

const file = JSON.parse(readFileSync(lexiconPath, "utf8"));
type Raw = { id: string; target: string; targetNormalized: string; pos: string; glossEn: string };
const entries: Raw[] = file.entries;

let tanwinFixed = 0;
let handFixed = 0;
let split = 0;
const changes: string[] = [];
const unresolved: string[] = [];

for (const e of entries) {
  if (e.pos !== "verb") continue;

  if (SPLIT_COMPOUNDS[e.id]) {
    const next = SPLIT_COMPOUNDS[e.id];
    changes.push(`  ${e.id} spelling  ${e.target} → ${next}`);
    e.target = next;
    e.targetNormalized = normalizeDari(next);
    split++;
    continue;
  }

  const head = e.targetNormalized.split(" ").at(-1)!;
  if (INFINITIVE.test(head) || EXEMPT.has(e.id)) continue;

  // 1. Deterministic: Arabic tanwin marks an adverb.
  if (TANWIN.test(e.target)) {
    changes.push(`  ${e.id} pos       ${e.target} verb → adverb  (tanwin)`);
    e.pos = "adverb";
    tanwinFixed++;
    continue;
  }

  // 2. Hand-classified.
  const fix = POS_FIXES[e.id];
  if (fix) {
    changes.push(`  ${e.id} pos       ${e.target} verb → ${fix}`);
    e.pos = fix;
    handFixed++;
    continue;
  }

  unresolved.push(`  ${e.id} ${e.target} "${e.glossEn}"`);
}

console.log(changes.join("\n"));
console.log(
  `\n${tanwinFixed} tanwin→adverb, ${handFixed} hand-classified, ${split} compound spellings, ` +
    `${EXEMPT.size} exempt`,
);
if (unresolved.length) {
  console.log(`\nSTILL pos=verb but not an infinitive (needs a decision):\n${unresolved.join("\n")}`);
}

if (dryRun) {
  console.log("\n[dry-run] no changes written");
} else {
  writeFileSync(lexiconPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nWrote ${lexiconPath}`);
}
