/**
 * Count the Catalan lexicon entries that cannot teach anything, by level.
 *
 * The burndown metric for the content repair. Read-only by design: the one
 * existing script that can drop entries (`audit-ca-lexicon.ts --fix`) also
 * renumbers `freqRank` and `id` densely, which would orphan every
 * `user_words.lexeme_id` row and every `token.lexemeId` stored inside a cached
 * text. Repairs happen in place; this only reports.
 *
 * Exits non-zero when a defect sits inside the B2 envelope, because a broken
 * entry at rank 84 is a word a beginner meets in their first week, while one at
 * rank 4,200 is not reachable yet.
 *
 * Usage: node scripts/audit-ca-content.ts [--list <defect>] [--limit N]
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { levelsFileSchema, lexiconFileSchema } from "../src/lib/content/schema.ts";
import { entryDefects, type EntryDefect } from "./verify-ca-entries.ts";

const root = join(import.meta.dirname, "..", "content", "ca");
const entries = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
).entries;
const levels = levelsFileSchema.parse(
  JSON.parse(readFileSync(join(root, "levels", "levels.json"), "utf8")),
).levels;

/** Everything a learner can reach by the time they are at B2. */
const b2 = levels.find((l) => l.cefrHint === "B2");
const envelope = b2?.entryKnownWords ?? entries.length;

const flagged = entries
  .map((e) => ({ entry: e, defects: entryDefects(e) }))
  .filter((r) => r.defects.length > 0);

const list = process.argv.indexOf("--list");
if (list !== -1) {
  const wanted = process.argv[list + 1] as EntryDefect;
  const limitAt = process.argv.indexOf("--limit");
  const limit = limitAt !== -1 ? Number(process.argv[limitAt + 1]) : 50;
  const rows = flagged
    .filter((r) => r.defects.includes(wanted))
    .sort((a, b) => a.entry.freqRank - b.entry.freqRank)
    .slice(0, limit);
  for (const r of rows) {
    console.log(
      `${String(r.entry.freqRank).padStart(5)}  ${r.entry.id}  ${r.entry.target}  ` +
        `[${r.entry.pos}]  ${JSON.stringify(r.entry.glossEn)}`,
    );
  }
  console.log(`\n${rows.length} shown of ${flagged.filter((r) => r.defects.includes(wanted)).length}`);
  process.exit(0);
}

// Which level would teach a word of this rank.
function levelOf(rank: number): string {
  for (let i = 0; i < levels.length; i++) {
    if (rank <= levels[i].entryKnownWords) return `${levels[i].id} ${levels[i].cefrHint}`;
  }
  return "beyond the top level";
}

const KINDS: EntryDefect[] = [
  "placeholder-gloss",
  "example-is-headword",
  "untranslated-example",
  "missing-example",
  "noun-tagged-infinitive",
];

console.log(`ca lexicon: ${entries.length} entries, B2 envelope is rank <= ${envelope}\n`);

console.log("defect                    total   in B2 envelope");
for (const kind of KINDS) {
  const all = flagged.filter((r) => r.defects.includes(kind));
  const inEnvelope = all.filter((r) => r.entry.freqRank <= envelope);
  console.log(
    `${kind.padEnd(24)} ${String(all.length).padStart(5)}   ${String(inEnvelope.length).padStart(14)}`,
  );
}

const distinct = flagged.filter((r) => r.entry.freqRank <= envelope);
console.log(
  `\n${flagged.length} distinct entries affected, ${distinct.length} inside the B2 envelope.`,
);

console.log("\nby level:");
const byLevel = new Map<string, number>();
for (const r of distinct) {
  const key = levelOf(r.entry.freqRank);
  byLevel.set(key, (byLevel.get(key) ?? 0) + 1);
}
for (const level of levels) {
  const key = `${level.id} ${level.cefrHint}`;
  const n = byLevel.get(key) ?? 0;
  if (level.entryKnownWords > envelope) continue;
  console.log(`  ${key.padEnd(12)} ${String(n).padStart(4)}`);
}

if (distinct.length > 0) {
  console.error(
    `\n${distinct.length} unteachable entr${distinct.length === 1 ? "y" : "ies"} inside the B2 envelope.`,
  );
  process.exit(1);
}
console.log("\nNo unteachable entries inside the B2 envelope.");
