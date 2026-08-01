/**
 * Reclassify Catalan infinitives that were filed as nouns.
 *
 * A bulk generation pass tagged 290 entries `pos: "noun"` regardless of what
 * they were, and 52 of them are verbs: `demanar`, `construir`, `resoldre`,
 * `conduir`. A wrong part of speech is not cosmetic here - it drives the
 * reader's colour coding, decides whether tapping the word offers a
 * conjugation table, and feeds the part-of-speech quotas that decide what a
 * text teaches.
 *
 * The ending cannot decide this on its own. `darrer` is an adjective and
 * `registre`, `pare`, `carrer` and `llibre` are nouns, and the conjugator will
 * cheerfully build a paradigm for any of them. So the test is whether the
 * paradigm is *attested*: a real verb's conjugated forms appear in the corpora,
 * and an invented one's do not. `darrer` yields `darrerem`, `darreria`,
 * `darrerien`, none of which any Catalan text contains.
 *
 * Needs the corpora that scripts/build-frequency.ts downloads:
 *   node scripts/build-frequency.ts --lang ca --download
 *
 * Usage: node scripts/fix-ca-verb-pos.ts [--apply]
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema } from "../src/lib/content/schema.ts";
import { conjugationSurfaces } from "../src/lib/lang/ca/conjugate.ts";
import { verbSpec } from "../src/lib/lang/ca/lexicon-index.ts";
import { matchKey, normalizeCatalan, tokenizeCatalan } from "../src/lib/lang/ca/normalize.ts";
import { entryDefects } from "./verify-ca-entries.ts";

/**
 * How many distinct conjugated forms must appear in the corpora.
 *
 * A real verb contributes dozens. A handful is enough to separate it from a
 * noun that merely ends in -ar/-er/-re/-ir, while tolerating a rare verb the
 * subtitle and encyclopedia corpora barely contain.
 */
const MIN_ATTESTED_FORMS = 2;

/**
 * The future and conditional endings, which settle the question on their own.
 *
 * Counting attested forms alone is not enough, because short generated forms
 * collide with unrelated real words: the noun `recer` "scores" on *recent*,
 * *rec* and *recs*, and the adjective `feiner` on *fein*. Those are different
 * words that happen to match.
 *
 * The Catalan future and conditional are built on the whole infinitive, so
 * their endings cannot be produced by a noun's inflection - a corpus containing
 * `reprendrà` or `inscriurien` is a corpus in which that verb is used. Nothing
 * else in the paradigm is as safe: the gerund of `recer` would be *recent*,
 * which is also a common adjective.
 */
const UNAMBIGUOUSLY_VERBAL = /(ré|ràs|rà|rem|reu|ran|ria|ries|ríem|ríeu|rien)$/;

/**
 * The gerund counts too, but only for the -ar conjugation.
 *
 * `formular` is a real verb whose future simply does not occur in these
 * corpora, but `formulant` does, and no Catalan noun or adjective in -ar
 * inflects to -ant. The same reasoning does not hold for -er and -re, where the
 * gerund lands on -ent and collides with a large family of ordinary adjectives
 * (`recent`, `present`, `absent`) - which is exactly how the noun `recer` was
 * mistaken for a verb.
 */
function gerundOfArVerb(infinitive: string): string | null {
  return /ar$/i.test(infinitive) ? `${infinitive.slice(0, -2)}ant` : null;
}

const corpusDir = join(import.meta.dirname, "data", "corpus");
const CORPORA = [
  { file: "ca-opensubtitles.txt", format: "hermitdave" as const },
  { file: "ca-wikipedia.txt", format: "leipzig" as const },
];

function corpusSurfaces(): Set<string> {
  const out = new Set<string>();
  for (const { file, format } of CORPORA) {
    const path = join(corpusDir, file);
    if (!existsSync(path)) {
      throw new Error(
        `Missing ${path}. Run: node scripts/build-frequency.ts --lang ca --download`,
      );
    }
    for (const line of readFileSync(path, "utf8").split("\n")) {
      if (!line) continue;
      const word = format === "leipzig" ? line.split("\t")[1] : line.slice(0, line.lastIndexOf(" "));
      if (!word || !/\p{L}/u.test(word)) continue;
      for (const token of tokenizeCatalan(word)) out.add(matchKey(token));
    }
  }
  return out;
}

const root = join(import.meta.dirname, "..", "content", "ca");
const path = join(root, "lexicon", "lexicon.json");
const file = JSON.parse(readFileSync(path, "utf8"));
lexiconFileSchema.parse(file);

const attested = corpusSurfaces();
const apply = process.argv.includes("--apply");

let changed = 0;
const kept: string[] = [];

for (const e of file.entries) {
  if (!entryDefects(e).includes("noun-tagged-infinitive")) continue;

  const spec = verbSpec(normalizeCatalan(e.target));
  if (!spec) continue;
  // Count only forms that differ from the headword, so a noun is not credited
  // for its own appearance in the corpus.
  const forms = conjugationSurfaces(spec).filter((f) => matchKey(f) !== matchKey(e.target));
  const hits = [...new Set(forms.map(matchKey))].filter((f) => attested.has(f));
  const gerund = gerundOfArVerb(normalizeCatalan(e.target));
  const gerundKey = gerund ? matchKey(gerund) : null;
  const verbal = hits.filter((f) => UNAMBIGUOUSLY_VERBAL.test(f) || f === gerundKey);

  if (hits.length >= MIN_ATTESTED_FORMS && verbal.length >= 1) {
    console.log(
      `verb   ${String(e.freqRank).padStart(5)}  ${e.target.padEnd(14)} ` +
        `${hits.length} attested, incl. ${verbal.slice(0, 3).join(", ")}`,
    );
    e.pos = "verb";
    changed++;
  } else {
    kept.push(
      `not a verb  ${String(e.freqRank).padStart(5)}  ${e.target.padEnd(14)} ` +
        `${hits.length} attested, ${verbal.length} unambiguously verbal`,
    );
  }
}

if (kept.length) console.log(`\n${kept.join("\n")}`);
console.log(`\n${changed} entr${changed === 1 ? "y" : "ies"} reclassified as verbs, ${kept.length} left alone.`);

if (!apply) {
  console.log("(dry run - pass --apply to rewrite the lexicon)");
} else {
  lexiconFileSchema.parse(file);
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
  console.log(`rewrote ${path}`);

  // Print the change in the terms it is about. "142 repaired" is not
  // checkable; "noun 290 -> 63, verb 0 -> 43" is, and it is the view in which
  // one wrong label stands out.
  const { execFileSync } = await import("node:child_process");
  execFileSync(
    process.execPath,
    [join(import.meta.dirname, "lexicon-diff.ts"), "--lang", "ca"],
    { stdio: "inherit" },
  );

}
