/**
 * Find the Catalan words a learner will meet that the lexicon does not have.
 *
 * The lexicon holds 4,343 lemmas. A real CEFR B2 is around 4,000, and the level
 * table needs headroom above its top threshold, so B2 is currently compressed
 * to 2,941 words - it is labelled B2 but is not one. Closing that needs roughly
 * 1,200 more verified entries.
 *
 * Those words should not be invented. A model asked for "B2 Catalan vocabulary"
 * produces plausible words with no evidence anyone uses them, and this lexicon
 * already carries 445 entries from exactly that kind of pass. Instead, mine the
 * corpora already downloaded for `build-frequency.ts`: a surface that appears
 * in *both* the subtitle and encyclopedia lists but resolves to nothing is, by
 * construction, a word learners meet and the app cannot explain. There are
 * about 32,000 of them, and the top of the list is plainly core vocabulary -
 * forma, rei, cop, morir, senyor, general, principal, clar, únic, matar,
 * centre, ordre, nombre, crear, posició, regne, segle, direcció.
 *
 * Output is a reviewable TSV, not lexicon entries. Turning a candidate into an
 * entry needs a gloss, a part of speech and an example, which is
 * `expand-ca-lexicon.ts`'s job and is gated by `verifyEntry`.
 *
 * Usage: node scripts/mine-ca-candidates.ts [--limit 1500] [--out <path>]
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema } from "../src/lib/content/schema.ts";
import { conjugationSurfaces } from "../src/lib/lang/ca/conjugate.ts";
import { buildLexiconIndex, nominalForms, verbSpec } from "../src/lib/lang/ca/lexicon-index.ts";
import { matchKey, normalizeCatalan, tokenizeCatalan } from "../src/lib/lang/ca/normalize.ts";
import { obsoleteSpellings } from "./verify-ca-entries.ts";

/**
 * Words to drop before a human ever sees the list.
 *
 * Every one of these was in the first hundred candidates of a real run, so the
 * filters are observations rather than precautions.
 */

/** English and other Latin-script noise the subtitle corpus carries. */
const NOT_CATALAN = /[kwyñêâîôûãõ]/i;

/**
 * Valencian and Balearic forms. The app teaches the Barcelona standard and its
 * prompts say so, so a Valencian variant in the lexicon would contradict the
 * course. `seua`, `seues`, `meua`, `teua`, `vosatros`.
 */
const NON_CENTRAL = /^(meu|teu|seu)a?s?$|^(vosatros|natros|este|esta|estos|estes)$/i;

/**
 * The literary simple past. `fou`, `anà`, `parlà` are correct Catalan and are
 * ranked high by the Wikipedia corpus, but the course deliberately teaches the
 * periphrastic past instead - every level's grammar says so.
 */
const LITERARY_PAST = /^(fou|hagué|vingué|anà|digué|féu|tingué|posà|donà|deixà|quedà|passà|arribà|començà)$/i;

/** Wikipedia's auto-generated municipality tables inflate these. */
const CENSUS_ARTEFACT = /^(hectàrees|habitatges|inactives|actives|mediana|cens|padró|densitat)$/i;

interface Source {
  file: string;
  format: "hermitdave" | "leipzig";
}

const CORPORA: Source[] = [
  { file: "ca-opensubtitles.txt", format: "hermitdave" },
  { file: "ca-wikipedia.txt", format: "leipzig" },
];

const corpusDir = join(import.meta.dirname, "data", "corpus");

/**
 * How often a surface is written capitalised, from the corpus that keeps case.
 *
 * Proper nouns are the largest remaining noise class - `john`, `boston`,
 * `madrid`, `sant` - and they are indistinguishable from common nouns once
 * everything is lowercased for matching. The encyclopedia list preserves case,
 * and a word that is capitalised almost every time it appears mid-corpus is a
 * name. Ordinary words are capitalised only at the start of a sentence, which
 * in a frequency list is a small minority of their occurrences.
 */
function capitalisationRate(source: Source): Map<string, number> {
  const upper = new Map<string, number>();
  const total = new Map<string, number>();
  for (const line of readFileSync(join(corpusDir, source.file), "utf8").split("\n")) {
    const parts = line.split("\t");
    if (parts.length < 3) continue;
    const surface = parts[1];
    const count = Number(parts[2]);
    if (!surface || !Number.isFinite(count) || count <= 0) continue;
    const key = matchKey(surface);
    if (!key) continue;
    total.set(key, (total.get(key) ?? 0) + count);
    if (surface[0] !== surface[0].toLowerCase()) upper.set(key, (upper.get(key) ?? 0) + count);
  }
  const rate = new Map<string, number>();
  for (const [k, n] of total) rate.set(k, (upper.get(k) ?? 0) / n);
  return rate;
}

function readRanks(source: Source): Map<string, number> {
  const path = join(corpusDir, source.file);
  if (!existsSync(path)) {
    throw new Error(`Missing ${path}. Run: node scripts/build-frequency.ts --lang ca --download`);
  }
  const counts = new Map<string, number>();
  for (const line of readFileSync(path, "utf8").split("\n")) {
    if (!line) continue;
    let surface: string;
    let count: number;
    if (source.format === "leipzig") {
      const parts = line.split("\t");
      if (parts.length < 3) continue;
      surface = parts[1];
      count = Number(parts[2]);
    } else {
      const at = line.lastIndexOf(" ");
      if (at <= 0) continue;
      surface = line.slice(0, at);
      count = Number(line.slice(at + 1));
    }
    if (!surface || !Number.isFinite(count) || count <= 0) continue;
    for (const token of tokenizeCatalan(surface)) {
      const key = matchKey(token);
      if (key) counts.set(key, (counts.get(key) ?? 0) + count);
    }
  }
  const ranks = new Map<string, number>();
  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([w], i) => ranks.set(w, i + 1));
  return ranks;
}

const root = join(import.meta.dirname, "..", "content", "ca");
const entries = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
).entries;
const index = buildLexiconIndex(entries);

const [subs, wiki] = CORPORA.map(readRanks);
const capitalised = capitalisationRate(CORPORA[1]);

/** Above this share of capitalised occurrences, treat the word as a name. */
const PROPER_NOUN_RATE = 0.6;

interface Candidate {
  word: string;
  score: number;
  subs: number;
  wiki: number;
}

const rejected = new Map<string, number>();
const reject = (why: string) => rejected.set(why, (rejected.get(why) ?? 0) + 1);

const candidates: Candidate[] = [];
for (const [word, subsRank] of subs) {
  const wikiRank = wiki.get(word);
  // Present in only one corpus is weak evidence: the subtitle list is full of
  // colloquial spellings and the encyclopedia list of place names.
  if (wikiRank === undefined) continue;

  if (word.length < 3) { reject("too short"); continue; }
  if (index.resolve(word)) continue; // already covered, including by morphology
  if (NOT_CATALAN.test(word)) { reject("not Catalan"); continue; }
  if (NON_CENTRAL.test(word)) { reject("not central Catalan"); continue; }
  if (LITERARY_PAST.test(word)) { reject("literary past"); continue; }
  if (CENSUS_ARTEFACT.test(word)) { reject("census artefact"); continue; }
  if (obsoleteSpellings(word).length) { reject("pre-2017 spelling"); continue; }
  if ((capitalised.get(word) ?? 0) > PROPER_NOUN_RATE) { reject("proper noun"); continue; }

  // Geometric mean of the two ranks: a word has to do reasonably well in both.
  candidates.push({
    word,
    score: Math.sqrt(subsRank * wikiRank),
    subs: subsRank,
    wiki: wikiRank,
  });
}

candidates.sort((a, b) => a.score - b.score);

/**
 * Collapse inflected forms onto the lemma that generates them.
 *
 * `únic` and `única`, `roig` and `roja`, `dirigir` and `dirigeix` are one entry
 * each, not two, and the lexicon stores the lemma. Working down the ranked list
 * and removing everything the current candidate can generate keeps the more
 * frequent member - which for a noun or adjective is normally the masculine
 * singular, and the reason to keep it rather than an arbitrary form.
 */
const lemmas: Candidate[] = [];
const absorbed = new Set<string>();
for (const c of candidates) {
  if (absorbed.has(c.word)) continue;
  lemmas.push(c);
  // These generators are built for real lexicon entries; a mining run feeds
  // them arbitrary corpus tokens, so a malformed one must not stop the run.
  let forms: string[] = [];
  try {
    const spec = verbSpec(normalizeCatalan(c.word));
    forms = spec
      ? conjugationSurfaces(spec)
      : [...nominalForms(c.word, "noun"), ...nominalForms(c.word, "adjective")];
  } catch {
    forms = [];
  }
  for (const f of forms) {
    const key = matchKey(f);
    if (key !== c.word) absorbed.add(key);
  }
}
console.log(`${absorbed.size.toLocaleString()} inflected forms folded into their lemma`);

const limitAt = process.argv.indexOf("--limit");
const limit = limitAt !== -1 ? Number(process.argv[limitAt + 1]) : 1500;
const outAt = process.argv.indexOf("--out");
const out = outAt !== -1 ? process.argv[outAt + 1] : join(import.meta.dirname, "data", "ca-candidates.tsv");

const chosen = lemmas.slice(0, limit);
writeFileSync(
  out,
  ["rank\tword\tsubsRank\twikiRank", ...chosen.map((c, i) => `${i + 1}\t${c.word}\t${c.subs}\t${c.wiki}`)].join("\n") + "\n",
);

console.log(`${candidates.length.toLocaleString()} unresolved surfaces present in both corpora`);
console.log(`rejected: ${[...rejected.entries()].map(([w, n]) => `${w} ${n}`).join(", ")}`);
console.log(`wrote ${chosen.length} candidates to ${out}\n`);
console.log("top 40:");
console.log(chosen.slice(0, 40).map((c) => c.word).join(", "));
console.log("\naround 750:");
console.log(chosen.slice(740, 770).map((c) => c.word).join(", "));
