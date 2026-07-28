/**
 * Build content/ca/lexicon/lexicon.json from the curated core word list.
 *
 * The whole file is hand-curated rather than generated: headword, POS, gloss
 * and example all key the reader, the SRS and every generated text, so a
 * hallucination anywhere corrupts the app. This script's job is to verify that
 * curation against the real Catalan engine and emit the lexicon.
 *
 * Verification per entry:
 *   - the headword must actually appear in its example, in some inflected form
 *     the Catalan conjugator/pluraliser can produce;
 *   - the example must tokenize to a sane length;
 * *   - no two headwords may share a match key, since one key maps to one lexeme.
 * Any failure aborts the build rather than shipping a lexicon the reader
 * cannot explain.
 *
 * Run: node --env-file=.env.local scripts/build-ca-lexicon.ts [--limit N] [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ca } from "../src/lib/lang/ca/index.ts";
import { conjugationSurfaces } from "../src/lib/lang/ca/conjugate.ts";
import { nominalForms, verbSpec } from "../src/lib/lang/ca/lexicon-index.ts";

const dryRun = process.argv.includes("--dry-run");
const limitFlag = process.argv.indexOf("--limit");
const limit = limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) : Infinity;

const root = join(import.meta.dirname, "..");
const outPath = join(root, "content", "ca", "lexicon", "lexicon.json");
interface Core {
  rank: number;
  word: string;
  pos: string;
  gloss: string;
  example: string;
  exampleEn: string;
}

const core: Core[] = readFileSync(join(root, "scripts", "data", "ca-core-words.txt"), "utf8")
  .split("\n")
  .filter((l) => l.trim() && !l.startsWith("#"))
  .map((l) => {
    const [rank, word, pos, gloss, example, exampleEn] = l.split("|");
    return {
      rank: Number(rank),
      word: word.trim(),
      pos: pos.trim(),
      gloss: gloss.trim(),
      example: (example ?? "").trim(),
      exampleEn: (exampleEn ?? "").trim(),
    };
  });

/** 1 = ~100 most frequent … 8 = rare. Mirrors the Dari banding. */
const bandOf = (rank: number): number =>
  rank <= 100 ? 1 : rank <= 300 ? 2 : rank <= 700 ? 3 : rank <= 1500 ? 4 : rank <= 3000 ? 5 : 6;

/** Every surface form the app could resolve back to this headword. */
function surfacesFor(c: Core): Set<string> {
  const set = new Set<string>([ca.text.matchKey(c.word)]);
  if (c.pos === "verb") {
    const spec = verbSpec(c.word);
    if (spec) for (const f of conjugationSurfaces(spec)) set.add(ca.text.matchKey(f));
  } else {
    for (const f of nominalForms(c.word, c.pos)) set.add(ca.text.matchKey(f));
  }
  return set;
}

const todo = core.slice(0, Number.isFinite(limit) ? limit : core.length);

/**
 * Verify each curated example really contains its own headword, in a form the
 * Catalan engine can resolve. This is the check that makes the lexicon
 * trustworthy: it is run against the same conjugator and pluraliser the reader
 * uses, so an example the app could not explain never ships.
 */
const problems: string[] = [];
const seenKeys = new Map<string, string>();
for (const c of todo) {
  const key = ca.text.matchKey(c.word);
  const clash = seenKeys.get(key);
  if (clash) problems.push(`${c.word}: duplicate match key with "${clash}"`);
  seenKeys.set(key, c.word);

  if (!c.example || !c.exampleEn) {
    problems.push(`${c.word}: missing example`);
    continue;
  }
  const tokens = ca.text.tokenize(c.example).map(ca.text.matchKey);
  const headTokens = ca.text.tokenize(c.word).map(ca.text.matchKey);

  const contained =
    headTokens.length > 1
      ? // A multi-word phrase must appear as a contiguous run of tokens.
        tokens.some((_, i) => headTokens.every((h, j) => tokens[i + j] === h))
      : // A single word may appear in any form the engine can generate.
        tokens.some((t) => surfacesFor(c).has(t));

  if (!contained) {
    problems.push(`${c.word}: example does not contain the headword ("${c.example}")`);
  }
  if (tokens.length > 12) problems.push(`${c.word}: example too long (${tokens.length} tokens)`);
}

const entries = todo.map((c, i) => {
  return {
    id: `lx-${String(i + 1).padStart(4, "0")}`,
    target: c.word,
    targetNormalized: ca.text.normalize(c.word),
    glossEn: c.gloss,
    pos: c.pos,
    freqRank: c.rank,
    freqBand: bandOf(c.rank),
    register: "neutral",
    variants: [],
    exampleTarget: ca.text.normalize(c.example),
    exampleEn: c.exampleEn,
    tags: [],
  };
});

const file = {
  formatVersion: "1.4.0",
  language: "ca",
  glossLanguage: "en",
  license: "CC BY-SA 4.0",
  entries,
};

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 25)) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log(`\n${entries.length} entries, every example verified against the Catalan engine`);
if (dryRun) console.log("[dry-run] no changes written");
else {
  writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`Wrote ${outPath}`);
}
