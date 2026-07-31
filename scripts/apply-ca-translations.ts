/**
 * Fill in the English for Catalan examples that never got one.
 *
 * 155 entries carry an `exampleEn` of `"Translated: "` followed by the Catalan
 * sentence itself, so the example teaches nothing to a reader who cannot
 * already read it. The gloss and the Catalan are correct in every one of these
 * - only the English is missing - which is why they are repaired separately
 * from the 290 entries that need a gloss, a part of speech and an example
 * written from scratch.
 *
 * The translations are authored in scripts/data/ca-example-translations.json.
 * This applies them, and refuses anything that would leave the entry no better
 * than it was.
 *
 * Usage: node scripts/apply-ca-translations.ts [--apply]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema } from "../src/lib/content/schema.ts";

const root = join(import.meta.dirname, "..", "content", "ca");
const path = join(root, "lexicon", "lexicon.json");
const file = JSON.parse(readFileSync(path, "utf8"));
lexiconFileSchema.parse(file);

const translations: Record<string, string> = JSON.parse(
  readFileSync(join(import.meta.dirname, "data", "ca-example-translations.json"), "utf8"),
);

const apply = process.argv.includes("--apply");
const problems: string[] = [];
let changed = 0;
let skipped = 0;

for (const e of file.entries) {
  const wanted = translations[e.id];
  if (!wanted) continue;

  // Never overwrite an entry that has since been repaired by other means.
  if (!/^\s*translated\s*:/i.test(e.exampleEn ?? "")) {
    skipped++;
    continue;
  }

  // The defect being fixed is "the English is the Catalan", so a translation
  // that is still the Catalan, or is still prefixed, is not a repair.
  if (/^\s*translated\s*:/i.test(wanted)) {
    problems.push(`${e.id}: translation still carries the "Translated:" prefix`);
    continue;
  }
  if (wanted.trim() === e.exampleTarget?.trim()) {
    problems.push(`${e.id}: translation is identical to the Catalan sentence`);
    continue;
  }
  if (!/[a-z]/i.test(wanted) || wanted.trim().length < 4) {
    problems.push(`${e.id}: translation is empty or too short`);
    continue;
  }

  e.exampleEn = wanted;
  changed++;
}

const missing = file.entries.filter(
  (e: { id: string; exampleEn?: string }) =>
    /^\s*translated\s*:/i.test(e.exampleEn ?? "") && !translations[e.id],
);

console.log(`${changed} translated, ${skipped} already repaired, ${missing.length} still without one`);
if (missing.length) {
  console.log(`  missing: ${missing.slice(0, 10).map((e: { id: string }) => e.id).join(", ")}`);
}
if (problems.length) {
  console.error(`\n${problems.length} rejected:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

if (!apply) {
  console.log("(dry run - pass --apply to rewrite the lexicon)");
} else {
  lexiconFileSchema.parse(file);
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
  console.log(`rewrote ${path}`);
}
