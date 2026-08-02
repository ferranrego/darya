/**
 * Append new lexicon entries from an authored file.
 *
 * The beginner core is curated rather than mined, so it names words the
 * lexicon may not have: Dari was missing every day of the week, plus salt,
 * potato, table, wall, shirt and yellow. Those cannot be tagged into
 * reachability - they have to exist first.
 *
 * New entries go at the *tail* of the frequency order. That is honest: a word
 * absent from the corpora is genuinely rare in text, and `freqRank` means
 * frequency, not importance. What makes them reachable on day one is the
 * `beginner-core` tag, which is a separate claim about pedagogy. Appending
 * also means no existing rank moves, so no learner's placement shifts.
 *
 * Every entry is checked before it is written: ids are unique, match keys do
 * not collide with an existing word, and for Catalan `verifyEntry` applies the
 * same gate the repair pipeline uses.
 *
 * Usage: node scripts/add-lexicon-entries.ts --lang prs --from scripts/data/new-prs-beginner.json [--apply]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema, type LexiconEntry } from "../src/lib/content/schema.ts";
import { matchKey as caMatchKey, normalizeCatalan } from "../src/lib/lang/ca/normalize.ts";
import { matchKey as prsMatchKey, normalizeDari } from "../src/lib/lang/prs/normalize.ts";
import { contentRoot, targetLang } from "./content-path.ts";
import { verifyEntry } from "./verify-ca-entries.ts";

type NewEntry = Omit<LexiconEntry, "id" | "targetNormalized" | "freqRank" | "freqBand">;

const lang = targetLang();
const root = contentRoot();
const normalize = lang === "ca" ? normalizeCatalan : normalizeDari;
const matchKey = lang === "ca" ? caMatchKey : prsMatchKey;

const fromAt = process.argv.indexOf("--from");
if (fromAt === -1) throw new Error("--from <file> is required");
const authored: NewEntry[] = JSON.parse(readFileSync(process.argv[fromAt + 1], "utf8"));

const path = join(root, "lexicon", "lexicon.json");
const file = JSON.parse(readFileSync(path, "utf8"));
lexiconFileSchema.parse(file);
const entries: LexiconEntry[] = file.entries;

const keys = new Map<string, string>();
for (const e of entries) keys.set(matchKey(e.targetNormalized), e.id);

let nextId = Math.max(...entries.map((e) => Number(e.id.slice(3)))) + 1;
let nextRank = Math.max(...entries.map((e) => e.freqRank)) + 1;
const topBand = Math.max(...entries.map((e) => e.freqBand));

const problems: string[] = [];
const added: LexiconEntry[] = [];

for (const a of authored) {
  const targetNormalized = normalize(a.target);
  const key = matchKey(targetNormalized);
  const clash = keys.get(key);
  if (clash) {
    problems.push(`${a.target}: already in the lexicon as ${clash}`);
    continue;
  }

  if (lang === "ca") {
    const found = verifyEntry(
      {
        word: a.target,
        pos: a.pos,
        gloss: a.glossEn,
        example: a.exampleTarget,
        exampleEn: a.exampleEn,
      },
      keys,
    );
    if (found.length) {
      problems.push(`${a.target}: ${found.join("; ")}`);
      continue;
    }
  }

  const entry: LexiconEntry = {
    ...a,
    id: `lx-${String(nextId++).padStart(4, "0")}`,
    targetNormalized,
    // Tail of the frequency order; the beginner-core tag is what makes it
    // reachable early, not the rank.
    freqRank: nextRank++,
    freqBand: topBand,
    variants: a.variants ?? [],
    tags: a.tags ?? [],
  };
  keys.set(key, entry.id);
  added.push(entry);
}

console.log(`${added.length} to add, ${problems.length} rejected`);
for (const e of added.slice(0, 8)) console.log(`  ${e.id}  ${e.target}  [${e.pos}]  ${e.glossEn}`);
if (added.length > 8) console.log(`  … and ${added.length - 8} more`);
if (problems.length) {
  console.error(`\n${problems.length} rejected:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

// Validate the *assembled* file in both modes. Checking only on `--apply` made
// the dry run untrustworthy in the one way that matters: a batch of numerals
// authored with `pos: "number"` reported "67 to add, 0 rejected" and then threw
// on the schema. A dry run that passes has to mean the apply will pass.
file.entries = [...entries, ...added];
lexiconFileSchema.parse(file);

if (!process.argv.includes("--apply")) {
  console.log("\n(dry run - pass --apply to write them)");
} else {
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nrewrote ${path} (${entries.length} -> ${file.entries.length})`);
}
