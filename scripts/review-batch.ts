/**
 * Render authored lexicon entries the way a learner meets them.
 *
 * Written after a batch of 142 hand-repaired Catalan entries went in with
 * `registre` glossed as a verb. Every mechanical gate passed it: the charset
 * was right, the example contained the headword, the paradigm was the right
 * size. What no gate could see is that a card reading
 *
 *     registre        verb        record, register
 *
 * is obviously wrong to anyone who reads it, in any language. The defect was
 * not subtle - it was simply never *looked at*, because the work happened in a
 * 1.8 MB JSON diff where nothing is legible.
 *
 * So this prints a batch as cards. Reading twenty takes about a minute and
 * catches the class of error that costs the most: the kind a reviewer spots
 * instantly and a validator cannot express.
 *
 * Usage:
 *   node scripts/review-batch.ts --lang ca --repairs scripts/data/ca-gloss-repairs.json
 *   node scripts/review-batch.ts --lang ca --new scripts/data/new-ca-beginner.json
 *   node scripts/review-batch.ts --lang ca --ids lx-4222,lx-4105
 *   node scripts/review-batch.ts --lang ca --rank-max 700 --sample 20
 *
 * `--new` reads an authored file in `add-lexicon-entries.ts` format, so a batch
 * can be read *before* it is written. Without it the only way to see the cards
 * was to apply first and review after, which inverts the order the whole point
 * of this script depends on.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema, type LexiconEntry } from "../src/lib/content/schema.ts";
import { isRuledOut } from "../src/lib/content/teachability.ts";
import { contentRoot, targetLang } from "./content-path.ts";

function arg(name: string): string | undefined {
  const at = process.argv.indexOf(`--${name}`);
  return at !== -1 ? process.argv[at + 1] : undefined;
}

const lang = targetLang();
const entries = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(contentRoot(), "lexicon", "lexicon.json"), "utf8")),
).entries;

// --- which entries -----------------------------------------------------------

let selected: LexiconEntry[];
const repairsPath = arg("repairs");
const newPath = arg("new");
const ids = arg("ids");
const rankMax = arg("rank-max");

if (newPath) {
  // Not yet in the lexicon, so rank and band do not exist yet; everything a
  // reviewer actually judges - headword, part of speech, gloss, example - does.
  selected = (JSON.parse(readFileSync(newPath, "utf8")) as Partial<LexiconEntry>[]).map(
    (a, i) =>
      ({
        ...a,
        id: `new-${i}`,
        targetNormalized: a.target ?? "",
        freqRank: 0,
        freqBand: 0,
        variants: a.variants ?? [],
        tags: a.tags ?? [],
      }) as LexiconEntry,
  );
} else if (repairsPath) {
  const repairs: Record<string, { pos?: string; drop?: string }> = JSON.parse(
    readFileSync(repairsPath, "utf8"),
  );
  // Only the entries that were authored as real words; the ruled-out ones are a
  // decision, and they are listed separately at the end.
  const authored = new Set(Object.keys(repairs).filter((k) => repairs[k].pos));
  selected = entries.filter((e) => authored.has(e.id));
} else if (ids) {
  const wanted = new Set(ids.split(",").map((s) => s.trim()));
  selected = entries.filter((e) => wanted.has(e.id));
} else if (rankMax) {
  selected = entries.filter((e) => e.freqRank <= Number(rankMax));
} else {
  selected = entries;
}

selected = selected.filter((e) => !isRuledOut(e)).sort((a, b) => a.freqRank - b.freqRank);

const sample = arg("sample");
if (sample) {
  // Evenly spaced rather than random, so a run is reproducible and the sample
  // spans the whole frequency range instead of clustering.
  const step = Math.max(1, Math.floor(selected.length / Number(sample)));
  selected = selected.filter((_, i) => i % step === 0).slice(0, Number(sample));
}

// --- render ------------------------------------------------------------------

const TRANSLITERATED = lang !== "ca";

console.log(`${selected.length} entries, ${lang}\n`);

for (const e of selected) {
  const head = TRANSLITERATED && e.translit ? `${e.target}  (${e.translit})` : e.target;
  console.log(`  ${head}`);
  console.log(`  ${" ".repeat(0)}${e.pos.padEnd(12)} rank ${e.freqRank}   band ${e.freqBand}   ${e.register}`);
  console.log(`  ${e.glossEn}`);
  if (e.exampleTarget) {
    console.log(`    ${e.exampleTarget}`);
    if (TRANSLITERATED && e.exampleTranslit) console.log(`    ${e.exampleTranslit}`);
    console.log(`    ${e.exampleEn ?? ""}`);
  }
  if (e.variants.length) console.log(`    variants: ${e.variants.join(", ")}`);
  console.log();
}

// --- the shape of the batch, which is where a wrong label stands out ---------

const byPos = new Map<string, number>();
for (const e of selected) byPos.set(e.pos, (byPos.get(e.pos) ?? 0) + 1);

console.log("part of speech:");
for (const [pos, n] of [...byPos.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${pos.padEnd(12)} ${String(n).padStart(4)}`);
}

/**
 * Endings that usually indicate a part of speech, as a prompt to look rather
 * than a rule to enforce. Catalan is full of counter-examples - `pare` and
 * `carrer` are nouns that look like infinitives - so this only ever asks a
 * question. The one time it is silent and wrong costs nothing; the one time it
 * asks and is right saves a shipped defect.
 */
if (lang === "ca") {
  const suspicious = selected.filter((e) => {
    const t = e.target;
    if (e.pos !== "verb" && /(ar|ir)$/.test(t) && /^to\s/i.test(e.glossEn)) return true;
    if (e.pos === "verb" && !/(ar|er|re|ir)$/.test(t)) return true;
    if (e.pos !== "verb" && /^to\s/i.test(e.glossEn)) return true;
    if (e.pos === "noun" && /(ment|íssim)$/.test(t)) return true;
    return false;
  });
  if (suspicious.length) {
    console.log("\nworth a second look:");
    for (const e of suspicious) {
      console.log(`  ${e.target} [${e.pos}] - ${e.glossEn}`);
    }
  }
}
