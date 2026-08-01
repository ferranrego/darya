/**
 * Summarise what a content change actually did, in the terms the change is
 * about.
 *
 * "142 repaired" says nothing checkable. What a reviewer needs is the shape:
 * nouns 290 -> 63, verbs 0 -> 43, adjectives 0 -> 28 tells you at a glance
 * whether a batch that was supposed to fix parts of speech fixed them, and it
 * is the view in which a single wrong label - `registre` counted among the
 * verbs - is visible. That one shipped because the only view anyone had was a
 * diff of a 1.8 MB JSON file, where nothing is legible.
 *
 * Compares the working tree against any git revision, so it works before a
 * commit as well as after.
 *
 * Usage:
 *   node scripts/lexicon-diff.ts --lang ca            # against HEAD
 *   node scripts/lexicon-diff.ts --lang ca --since main
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { lexiconFileSchema, type LexiconEntry } from "../src/lib/content/schema.ts";
import { isRuledOut } from "../src/lib/content/teachability.ts";
import { contentRoot, targetLang } from "./content-path.ts";

const repo = join(import.meta.dirname, "..");
const lexiconPath = join(contentRoot(), "lexicon", "lexicon.json");
const tracked = relative(repo, lexiconPath);

const at = process.argv.indexOf("--since");
const since = at !== -1 ? process.argv[at + 1] : "HEAD";

function load(json: string): Map<string, LexiconEntry> {
  const parsed = lexiconFileSchema.parse(JSON.parse(json));
  return new Map(parsed.entries.map((e) => [e.id, e]));
}

let before: Map<string, LexiconEntry>;
try {
  before = load(
    execFileSync("git", ["show", `${since}:${tracked}`], { cwd: repo, maxBuffer: 1 << 28 }).toString(),
  );
} catch {
  console.error(`Could not read ${tracked} at ${since}.`);
  process.exit(1);
}
const after = load(readFileSync(lexiconPath, "utf8"));

// --- what moved --------------------------------------------------------------

const added: LexiconEntry[] = [];
const removed: string[] = [];
const changed: { id: string; fields: string[]; from: LexiconEntry; to: LexiconEntry }[] = [];

const FIELDS = [
  "target", "pos", "glossEn", "register", "freqRank", "freqBand",
  "exampleTarget", "exampleEn", "translit", "presentStem",
] as const;

for (const [id, a] of after) {
  const b = before.get(id);
  if (!b) { added.push(a); continue; }
  const fields = FIELDS.filter(
    (f) => JSON.stringify(b[f as keyof LexiconEntry]) !== JSON.stringify(a[f as keyof LexiconEntry]),
  );
  if (fields.length) changed.push({ id, fields, from: b, to: a });
}
for (const id of before.keys()) if (!after.has(id)) removed.push(id);

console.log(`${targetLang()} lexicon, working tree vs ${since}\n`);
console.log(`  entries   ${before.size} -> ${after.size}`);
console.log(`  added     ${added.length}`);
console.log(`  changed   ${changed.length}`);
if (removed.length) {
  // Never routine: user_words.lexeme_id is a foreign key and cached texts store
  // lexemeId inside their JSON, so a removal orphans real learner progress.
  console.error(`  REMOVED   ${removed.length}  ${removed.slice(0, 10).join(", ")}`);
}

// --- the shape, which is the point -------------------------------------------

function tally(entries: Iterable<LexiconEntry>, field: "pos" | "register") {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e[field], (m.get(e[field]) ?? 0) + 1);
  return m;
}

for (const field of ["pos", "register"] as const) {
  const b = tally(before.values(), field);
  const a = tally(after.values(), field);
  const keys = [...new Set([...b.keys(), ...a.keys()])].sort(
    (x, y) => (a.get(y) ?? 0) - (a.get(x) ?? 0),
  );
  const moved = keys.filter((k) => (b.get(k) ?? 0) !== (a.get(k) ?? 0));
  if (!moved.length) continue;
  console.log(`\n  ${field}`);
  for (const k of moved) {
    const from = b.get(k) ?? 0;
    const to = a.get(k) ?? 0;
    const delta = to - from;
    console.log(`    ${k.padEnd(14)} ${String(from).padStart(5)} -> ${String(to).padStart(5)}   ${delta > 0 ? "+" : ""}${delta}`);
  }
}

// --- teachability, which is what the repairs are for -------------------------

const teachableBefore = [...before.values()].filter((e) => !isRuledOut(e) && !/\[|auto-fill/i.test(e.glossEn)).length;
const teachableAfter = [...after.values()].filter((e) => !isRuledOut(e) && !/\[|auto-fill/i.test(e.glossEn)).length;
if (teachableBefore !== teachableAfter) {
  console.log(`\n  teachable      ${teachableBefore} -> ${teachableAfter}   +${teachableAfter - teachableBefore}`);
}

// --- a sample of the actual edits, so the numbers are not taken on trust -----

const posChanges = changed.filter((c) => c.fields.includes("pos"));
if (posChanges.length) {
  console.log(`\n  part of speech changed on ${posChanges.length} entries, for example:`);
  for (const c of posChanges.slice(0, 12)) {
    console.log(`    ${c.to.target.padEnd(16)} ${c.from.pos} -> ${c.to.pos}   ${c.to.glossEn.slice(0, 40)}`);
  }
}
