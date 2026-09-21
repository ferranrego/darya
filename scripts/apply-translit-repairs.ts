/**
 * Apply a reviewed transliteration repair file to the lexicon, in place.
 *
 * Repairs only the two transliteration fields of entries that already exist.
 * It cannot add, remove or renumber an entry, and it refuses an id it does not
 * find: `user_words.lexeme_id` is a foreign key and cached texts store
 * `lexemeId`, so a dropped or renumbered entry silently repoints real learner
 * progress at a different word.
 *
 *   node scripts/apply-translit-repairs.ts --repairs scripts/data/<file>.json [--dry]
 *
 * Read the cards first (`review-batch.ts --new <file>`), and prove what changed
 * afterwards (`lexicon-diff.ts`). This script is the mechanical middle step;
 * the judgement is in the file it reads.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentRoot } from "./content-path.ts";

interface Repair {
  id: string;
  translit?: string;
  translitWas?: string;
  exampleTranslit?: string;
  exampleTranslitWas?: string;
}

const at = process.argv.indexOf("--repairs");
const repairsPath = at !== -1 ? process.argv[at + 1] : undefined;
const dry = process.argv.includes("--dry");
if (!repairsPath) {
  console.error("usage: node scripts/apply-translit-repairs.ts --repairs <file.json> [--dry]");
  process.exit(1);
}

const repairs: Repair[] = JSON.parse(readFileSync(repairsPath, "utf8"));
const path = join(contentRoot(), "lexicon", "lexicon.json");
const file = JSON.parse(readFileSync(path, "utf8"));
const byId = new Map<string, Record<string, unknown>>(
  file.entries.map((e: Record<string, unknown>) => [e.id as string, e]),
);

let changed = 0;
const missing: string[] = [];
const stale: string[] = [];

for (const r of repairs) {
  const entry = byId.get(r.id);
  if (!entry) {
    missing.push(r.id);
    continue;
  }
  for (const [field, was] of [
    ["translit", r.translitWas],
    ["exampleTranslit", r.exampleTranslitWas],
  ] as const) {
    if (was === undefined) continue;
    // The repair was authored against a specific string. If the entry has moved
    // on since, applying anyway would overwrite whatever replaced it.
    if (entry[field] !== was) {
      stale.push(`${r.id}.${field}: expected ${JSON.stringify(was)}, found ${JSON.stringify(entry[field])}`);
      continue;
    }
    const next = field === "translit" ? r.translit : r.exampleTranslit;
    if (next === undefined || next === was) continue;
    entry[field] = next;
    changed++;
  }
}

if (missing.length) {
  console.error(`✗ ${missing.length} id(s) not in the lexicon: ${missing.slice(0, 5).join(", ")}`);
  process.exit(1);
}
if (stale.length) {
  console.error(`✗ ${stale.length} field(s) changed since the repair was authored:`);
  for (const s of stale.slice(0, 5)) console.error(`   ${s}`);
  process.exit(1);
}

console.log(`${changed} field(s) ${dry ? "would change" : "changed"} across ${repairs.length} entries`);
if (file.entries.length !== byId.size) {
  console.error("✗ entry count changed - refusing to write");
  process.exit(1);
}
if (!dry) {
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
  console.log(`written: ${path}`);
}
