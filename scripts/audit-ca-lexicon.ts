/**
 * Re-verify the whole Catalan lexicon and drop anything that fails.
 *
 * The generator verifies as it goes, but the harness keeps getting stricter as
 * real defects surface (exact duplicates, feminine dictionary forms, missing
 * apostrophation). This re-runs the current rules over everything already
 * written, so entries accepted under weaker rules do not survive.
 *
 * Also normalises example punctuation: the generator returns sentences without
 * a full stop, which looks unfinished on an SRS card.
 *
 * Run: node scripts/audit-ca-lexicon.ts [--fix]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { verifyEntry, type CandidateEntry } from "./verify-ca-entries.ts";

const fix = process.argv.includes("--fix");
const lexPath = join(import.meta.dirname, "..", "content", "ca", "lexicon", "lexicon.json");
const file = JSON.parse(readFileSync(lexPath, "utf8"));

interface Entry {
  id: string;
  target: string;
  pos: string;
  glossEn: string;
  exampleTarget: string;
  exampleEn: string;
  freqRank: number;
  [k: string]: unknown;
}

const entries: Entry[] = file.entries;
const seen = new Map<string, string>();
const kept: Entry[] = [];
const dropped: string[] = [];

for (const e of entries) {
  // A sentence with no terminal punctuation reads as truncated.
  if (fix && !/[.!?]$/.test(e.exampleTarget)) e.exampleTarget = `${e.exampleTarget}.`;
  if (fix && !/[.!?]$/.test(e.exampleEn)) e.exampleEn = `${e.exampleEn}.`;

  const candidate: CandidateEntry = {
    word: e.target,
    pos: e.pos,
    gloss: e.glossEn,
    example: e.exampleTarget,
    exampleEn: e.exampleEn,
  };
  const problems = verifyEntry(candidate, seen);
  if (problems.length) {
    dropped.push(`${e.target} (${e.pos}): ${problems.join("; ")}`);
    continue;
  }
  kept.push(e);
}

console.log(`entries: ${entries.length} -> kept ${kept.length}, dropped ${dropped.length}`);
for (const d of dropped.slice(0, 30)) console.log(`  ✗ ${d}`);
if (dropped.length > 30) console.log(`  … and ${dropped.length - 30} more`);

if (fix) {
  // Renumber so freqRank stays dense and ordered after removals.
  kept.sort((a, b) => a.freqRank - b.freqRank);
  kept.forEach((e, i) => {
    e.freqRank = i + 1;
    e.id = `lx-${String(i + 1).padStart(4, "0")}`;
  });
  file.entries = kept;
  writeFileSync(lexPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nWrote ${lexPath} (${kept.length} entries, ranks renumbered)`);
} else {
  console.log("\n(dry run - pass --fix to apply)");
}

// Report band distribution so levels can be sized against reality.
const bands: Record<number, number> = {};
for (const e of kept) bands[e.freqBand as number] = (bands[e.freqBand as number] ?? 0) + 1;
console.log(`bands: ${JSON.stringify(bands)}`);
