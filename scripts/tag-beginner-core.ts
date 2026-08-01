/**
 * Mark the words a beginner needs, whatever the corpus says about them.
 *
 * Frequency decides teaching *order*. It does not decide what a learner needs
 * on their first day, and no corpus will, because concrete nouns are rarer in
 * written text than abstract ones. Catalan's ranking is blended from subtitles
 * and Wikipedia and is correct as frequency - its L1 head is `estat`, `cosa`,
 * `part`, `vegada`, `manera`, `guerra`, `punt`, `acord`, `sistema`, `empresa` -
 * while `poma` sits at 1468, `plat` at 1161, `carn` at 818. Measured, 80 of the
 * 138 concrete beginner words present in the lexicon ranked past L1, so
 * "El gos menja carn" and "Quant costa la poma?" could not be written at the
 * level they belong to.
 *
 * The fix is additive rather than a re-ranking: this tags the curated list in
 * `content/<lang>/lexicon/beginner-core.txt`, and the generator lets the first
 * two levels teach anything so tagged. `freqRank` is untouched, because it is
 * correct and every level above L2 depends on it, and the tag does not make a
 * word count as already known - it makes it *teachable early*.
 *
 * Usage: node scripts/tag-beginner-core.ts --lang ca [--apply]
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema, type LexiconEntry } from "../src/lib/content/schema.ts";
import { isTeachable } from "../src/lib/content/teachability.ts";
import { buildLexiconIndex as buildCa } from "../src/lib/lang/ca/lexicon-index.ts";
import { buildLexiconIndex as buildPrs } from "../src/lib/lang/prs/lexicon-index.ts";
import { contentRoot, targetLang } from "./content-path.ts";

export const BEGINNER_CORE_TAG = "beginner-core";

/** Headwords from the curated list, comments and blanks dropped. */
export function readBeginnerCore(root: string): string[] {
  const path = join(root, "lexicon", "beginner-core.txt");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function main() {
  const lang = targetLang();
  const root = contentRoot();
  const apply = process.argv.includes("--apply");

  const path = join(root, "lexicon", "lexicon.json");
  const file = JSON.parse(readFileSync(path, "utf8"));
  lexiconFileSchema.parse(file);
  const entries: LexiconEntry[] = file.entries;
  const index = lang === "ca" ? buildCa(entries) : buildPrs(entries);

  const wanted = readBeginnerCore(root);
  const missing: string[] = [];
  const unteachable: string[] = [];
  const hit = new Set<string>();

  for (const word of wanted) {
    const entry = index.resolve(word);
    if (!entry) {
      missing.push(word);
      continue;
    }
    // A word whose gloss is a placeholder cannot be taught at any level, so
    // tagging it would only move the failure.
    if (!isTeachable(entry)) unteachable.push(`${word} (${entry.id})`);
    hit.add(entry.id);
  }

  let added = 0;
  let removed = 0;
  for (const e of entries) {
    const tags = new Set(e.tags);
    if (hit.has(e.id) && !tags.has(BEGINNER_CORE_TAG)) {
      tags.add(BEGINNER_CORE_TAG);
      added++;
    } else if (!hit.has(e.id) && tags.has(BEGINNER_CORE_TAG)) {
      // The list is the source of truth, so removing a line removes the tag.
      tags.delete(BEGINNER_CORE_TAG);
      removed++;
    }
    e.tags = [...tags];
  }

  const tagged = entries.filter((e) => e.tags.includes(BEGINNER_CORE_TAG));
  const pastL1 = tagged.filter((e) => e.freqRank > 700).length;
  console.log(
    `${lang}: ${wanted.length} wanted, ${tagged.length} tagged ` +
      `(+${added} -${removed}); ${pastL1} of them rank past ~L1, which is the point.`,
  );

  if (unteachable.length) {
    console.log(`\n${unteachable.length} tagged but not yet teachable:\n  ${unteachable.join(", ")}`);
  }
  if (missing.length) {
    console.log(`\n${missing.length} not in the lexicon at all:\n  ${missing.join(" ")}`);
  }

  if (!apply) {
    console.log("\n(dry run - pass --apply to write the tags)");
    return;
  }
  lexiconFileSchema.parse(file);
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nrewrote ${path}`);
}

main();
