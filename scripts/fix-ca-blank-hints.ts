/**
 * Restore the parentheses around the lemma hint in Catalan fillBlank exercises.
 *
 * A fillBlank that tests a verb form has to say which verb, so the authored
 * form in `scripts/data/grammar-yaml/ca/` writes it as a parenthesised hint:
 *
 *     target: És necessari que ella ___ (treballar) avui.
 *
 * The conversion into `content/ca/grammar/all.json` dropped the parentheses,
 * which turns the hint into part of the sentence. Filling the blank then reads
 * "És necessari que ella treballi treballar avui" - not Catalan, and the only
 * model of the subjunctive those lessons ever showed. 30 exercises across B1
 * and B2 were affected, which is 30 of the 162 fillBlanks at exactly the two
 * levels this work is about.
 *
 * The repair is mechanical and reversible: wrap the infinitive that directly
 * follows the blank. It never changes an answer, a distractor, or a translation
 * - `verify-ca-grammar.ts` decides what is broken and this only puts the
 * punctuation back.
 *
 * Usage: node scripts/fix-ca-blank-hints.ts [--apply]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { grammarCoursesFileSchema, lexiconFileSchema } from "../src/lib/content/schema.ts";
import { buildLexiconIndex } from "../src/lib/lang/ca/lexicon-index.ts";
import { strayInfinitive } from "./verify-ca-entries.ts";

const root = join(import.meta.dirname, "..", "content", "ca");
const index = buildLexiconIndex(
  lexiconFileSchema.parse(JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")))
    .entries,
);
const path = join(root, "grammar", "all.json");
const raw = JSON.parse(readFileSync(path, "utf8"));
// Parse to be sure the shape is what we think before rewriting it.
grammarCoursesFileSchema.parse(raw);

const apply = process.argv.includes("--apply");
let fixed = 0;
const rows: string[] = [];

for (const course of raw.courses) {
  for (const block of course.blocks) {
    for (const lesson of block.lessons) {
      for (const ex of lesson.exercises) {
        if (ex.type !== "fillBlank") continue;
        if (strayInfinitive(ex.target, ex.answer.target, index).length === 0) continue;

        // The offending word is the one immediately after the blank.
        const before = ex.target;
        const after = before.replace(/(___\s+)([^\s()]+)/, (_m: string, blank: string, word: string) => {
          // Keep any trailing punctuation outside the parentheses.
          const m = word.match(/^([\p{L}·'-]+)(.*)$/u);
          return m ? `${blank}(${m[1]})${m[2]}` : `${blank}(${word})`;
        });
        if (after === before) {
          rows.push(`${ex.id}: could not place the hint in "${before}"`);
          continue;
        }
        rows.push(`${course.level} ${ex.id}\n    ${before}\n -> ${after}`);
        ex.target = after;
        fixed++;
      }
    }
  }
}

console.log(rows.join("\n"));
console.log(`\n${fixed} exercise(s) with a bare lemma hint.`);

if (!apply) {
  console.log("(dry run - pass --apply to rewrite content/ca/grammar/all.json)");
} else {
  // Re-validate the whole file after editing, so a bad rewrite cannot ship.
  grammarCoursesFileSchema.parse(raw);
  writeFileSync(path, JSON.stringify(raw, null, 2) + "\n");
  console.log(`rewrote ${path}`);
}
