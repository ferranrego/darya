/**
 * Make one Dari word be spelled one way.
 *
 * The lexicon's 6,466 headword transliterations and the ~7,000 in example
 * sentences and seed texts were authored independently, so they drifted:
 * measured, 783 words carried more than one spelling across the content, and
 * 16% of uninflected word occurrences disagreed with their own headword. A
 * learner taps بسیار in a text reading `bisyār` and the card says `besyār`,
 * and with no audio in the app they have no third source to break the tie.
 *
 * The choice is made by the corpus, not by taste: for each lexeme, count how
 * its uninflected form is actually spelled across every sentence, and adopt
 * the majority. Where that majority is decisive the minority spellings and, if
 * it disagrees, the headword are rewritten to match. `rā` outnumbers `ra`
 * 891 to 25; `bisyār` outnumbers `besyār` 146 to 26. Those are not judgement
 * calls, they are counts.
 *
 * Deliberately conservative:
 *  - sentence-initial tokens are ignored entirely, so capitalisation is never
 *    mistaken for a spelling difference;
 *  - a sentence is only touched when its token count matches its
 *    transliteration's word count, so replacement is positional and certain;
 *  - a majority must be decisive (see below) or the word is left alone and
 *    reported, because a near-tie is a real decision and not this script's.
 *
 *   node scripts/normalise-translit.ts --dry
 *   node scripts/normalise-translit.ts --apply
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROFILES } from "../src/lib/lang/index.ts";
import { lexiconFileSchema } from "../src/lib/content/schema.ts";
import { contentRoot } from "./content-path.ts";

/** Below this share, or this many uses, the corpus has not actually decided. */
const MAJORITY_SHARE = 0.7;
const MIN_USES = 3;

const apply = process.argv.includes("--apply");
const profile = PROFILES.prs;
const lexPath = join(contentRoot(), "lexicon", "lexicon.json");
const raw = JSON.parse(readFileSync(lexPath, "utf8"));
const lexicon = lexiconFileSchema.parse(raw);
const index = profile.text.buildIndex(lexicon.entries);
const seedDir = join(contentRoot(), "texts", "seed");
const seedSrc = join(process.cwd(), "scripts", "data", "seed-texts-prs.ts");

const bare = (s: string) => s.replace(/-(ye|e|hā|ām|am|at|ash)$/u, "");
const split = (t: string) => t.split(/[\s,.?!;:()]+/).filter(Boolean);

/** Every sentence in the content, with where it came from. */
type Sentence = { target: string; translit: string; set: (t: string) => void };
const sentences: Sentence[] = [];
for (const e of raw.entries as Array<Record<string, string>>) {
  if (e.exampleTarget && e.exampleTranslit) {
    sentences.push({
      target: e.exampleTarget,
      translit: e.exampleTranslit,
      set: (t) => { e.exampleTranslit = t; },
    });
  }
}
let seedText = readFileSync(seedSrc, "utf8");
for (const file of readdirSync(seedDir)) {
  const doc = JSON.parse(readFileSync(join(seedDir, file), "utf8"));
  for (const s of doc.sentences) {
    if (!s.translit) continue;
    const original = s.translit as string;
    sentences.push({
      target: s.target,
      translit: original,
      // Seed JSON is generated, so the edit has to land in the source file.
      set: (t) => { seedText = seedText.split(`"${original}"`).join(`"${t}"`); },
    });
  }
}

/** How each lexeme's uninflected form is actually spelled, ignoring position 0. */
const counts = new Map<string, Map<string, number>>();
for (const s of sentences) {
  const toks = profile.text.tokenize(s.target);
  const latin = split(s.translit);
  if (toks.length !== latin.length) continue;
  toks.forEach((tok, i) => {
    if (i === 0) return;
    const e = index.resolve(tok);
    if (!e || profile.text.normalize(tok) !== e.targetNormalized) return;
    const m = counts.get(e.id) ?? new Map<string, number>();
    const form = bare(latin[i]);
    m.set(form, (m.get(form) ?? 0) + 1);
    counts.set(e.id, m);
  });
}

/** The spelling the corpus settled on, where it settled on one. */
const canonical = new Map<string, string>();
const undecided: string[] = [];
for (const [id, m] of counts) {
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  const [form, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  if (m.size === 1) continue;
  if (n >= MIN_USES && n / total >= MAJORITY_SHARE) canonical.set(id, form);
  else undecided.push(`${id} ${[...m.entries()].map(([f, c]) => `${f}(${c})`).join(" ")}`);
}

let sentenceEdits = 0;
let headwordEdits = 0;
for (const s of sentences) {
  const toks = profile.text.tokenize(s.target);
  const latin = split(s.translit);
  if (toks.length !== latin.length) continue;
  let next = s.translit;
  let changed = false;
  toks.forEach((tok, i) => {
    if (i === 0) return;
    const e = index.resolve(tok);
    if (!e || profile.text.normalize(tok) !== e.targetNormalized) return;
    const want = canonical.get(e.id);
    if (!want) return;
    const have = latin[i];
    if (bare(have) === want) return;
    // Preserve whatever ezafe or enclitic the sentence had attached - but an
    // ezafe's spelling depends on what it attaches to, so it has to be
    // re-derived rather than carried over. Shortening `barāy-e` to `barā-e`
    // by copying the tail produced exactly the form `bareEzafeAfterVowel`
    // exists to reject: after a vowel the ezafe is -ye.
    const rawTail = have.slice(bare(have).length);
    const tail =
      rawTail === "-e" || rawTail === "-ye"
        ? /[aāēīōū]$/u.test(want)
          ? "-ye"
          : "-e"
        : rawTail;
    next = next.replace(new RegExp(`(^|[\\s,.?!;:(])${have.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=[\\s,.?!;:)]|$)`), `$1${want}${tail}`);
    changed = true;
    sentenceEdits++;
  });
  if (changed) s.set(next);
}
for (const e of raw.entries as Array<Record<string, string>>) {
  const want = canonical.get(e.id);
  if (want && e.translit && bare(e.translit) !== want && !e.translit.includes(" ")) {
    e.translit = want + e.translit.slice(bare(e.translit).length);
    headwordEdits++;
  }
}

console.log(`lexemes with a settled spelling: ${canonical.size}`);
console.log(`lexemes the corpus has not decided (left alone): ${undecided.length}`);
console.log(`sentence spellings normalised: ${sentenceEdits}`);
console.log(`headwords brought into line: ${headwordEdits}`);
if (!apply) {
  console.log("\n(dry run - pass --apply to write)");
  undecided.slice(0, 10).forEach((u) => console.log("   undecided: " + u));
} else {
  lexiconFileSchema.parse(raw);
  writeFileSync(lexPath, JSON.stringify(raw, null, 2) + "\n");
  writeFileSync(seedSrc, seedText);
  console.log("\nwritten - run pnpm build:texts, then pnpm gate");
}
