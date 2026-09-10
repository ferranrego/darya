/**
 * Does a word get spelled the same way on its card as in the sentence a
 * learner met it in?
 *
 * This is invisible to every other check in the repo. `validate-content.ts`
 * asks whether a transliteration is Dari; nothing asks whether two Dari
 * transliterations of the same word agree. A beginner taps بسیار in a text
 * that reads `bisyār` and the word sheet says `besyār`, and with no audio in
 * the app they have no third source to break the tie.
 *
 * Measured when this was written: 16% of uninflected word occurrences
 * disagreed with their own headword, down from 32% before the transliteration
 * repairs - but the beginner texts got *worse*, from 10 disagreements to 123,
 * because those repairs used Kabuli short vowels (bisyār, masjid, kishwar)
 * while the older headwords use Iranian-influenced ones (besyār, masjed,
 * keshwar). Most of the newer spellings are the better Dari; that is not the
 * point. The learner sees two spellings of one word.
 *
 * Deliberately a report and not a gate. Which convention wins is a philologist
 * decision, not something a script should force, and failing the build on
 * thousands of entries would only teach people to ignore it.
 *
 *   node scripts/audit-translit-consistency.ts
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PROFILES } from "../src/lib/lang/index.ts";
import { lexiconFileSchema } from "../src/lib/content/schema.ts";
import { contentRoot } from "./content-path.ts";

const profile = PROFILES.prs;
const lexicon = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(contentRoot(), "lexicon", "lexicon.json"), "utf8")),
);
const index = profile.text.buildIndex(lexicon.entries);

/** A word in a sentence usually carries an ezafe or enclitic; a headword never does. */
const bare = (s: string) => s.replace(/-(ye|e|hā|ām|am|at|ash)$/u, "");

let checked = 0;
const disagreements = new Map<string, number>();

function scan(target: string, translit: string | undefined) {
  if (!translit) return;
  const latin = translit.split(/[\s,.?!;:()]+/).filter(Boolean).map(bare);
  for (const token of profile.text.tokenize(target)) {
    const entry = index.resolve(token);
    if (!entry?.translit || entry.translit.includes(" ")) continue;
    // Only uninflected occurrences: an inflected form has no transliteration
    // of its own anywhere in the repo, so a mismatch there proves nothing.
    if (profile.text.normalize(token) !== entry.targetNormalized) continue;
    checked++;
    const want = bare(entry.translit);
    if (latin.some((l) => l === want)) continue;
    const near =
      latin.find((l) => l[0] === want[0] && Math.abs(l.length - want.length) <= 2) ?? "?";
    const key = `${entry.translit} -> ${near}`;
    disagreements.set(key, (disagreements.get(key) ?? 0) + 1);
  }
}

const seedDir = join(contentRoot(), "texts", "seed");
let seedTotal = 0;
for (const file of readdirSync(seedDir)) {
  const doc = JSON.parse(readFileSync(join(seedDir, file), "utf8"));
  const before = [...disagreements.values()].reduce((a, b) => a + b, 0);
  for (const s of doc.sentences) scan(s.target, s.translit);
  seedTotal += [...disagreements.values()].reduce((a, b) => a + b, 0) - before;
}
const seedDisagreements = seedTotal;
for (const e of lexicon.entries) scan(e.exampleTarget ?? "", e.exampleTranslit);

const total = [...disagreements.values()].reduce((a, b) => a + b, 0);
console.log(`uninflected word occurrences checked: ${checked}`);
console.log(
  `spelled differently from their own headword: ${total} ` +
    `(${((100 * total) / checked).toFixed(1)}%) - ${seedDisagreements} of them in the beginner texts`,
);
console.log(`\ndistinct disagreements, commonest first (card -> sentence):`);
[...disagreements.entries()]
  .sort((a, b) => b[1] - a[1])
  .slice(0, 40)
  .forEach(([k, n]) => console.log(`  ${String(n).padStart(4)}x  ${k}`));
