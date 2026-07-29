/**
 * Apply the authored closed-class patch to the Catalan lexicon.
 *
 * The generated lexicon is good at open-class vocabulary and bad at everything
 * else: it produced 454 nouns but not one weak pronoun, so a learner tapping
 * `em`, `hi`, `al` or `sense` in the reader got nothing back. It also let a
 * handful of Spanish and misspelt forms through (`equipo`, `telefon`, `rabia`).
 *
 * Both are authored problems, so the fix is authored data
 * (`scripts/data/ca-closed-class.json`) applied here:
 *
 *   delete  - non-Catalan or non-standard entries, removed outright
 *   rename  - plural headwords moved to their dictionary singular
 *   patch   - gloss and surface variants added to entries that already exist
 *   add     - new closed-class entries, placed at the front of their band
 *
 * Everything then goes through `verifyEntry`, so the patch cannot introduce
 * anything the audit would later reject, and freqRank/id are renumbered so the
 * lexicon stays densely ordered.
 *
 * Run: node scripts/patch-ca-lexicon.ts [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeCatalan } from "../src/lib/lang/ca/normalize.ts";
import { verifyEntry, type CandidateEntry } from "./verify-ca-entries.ts";

const write = process.argv.includes("--write");
const root = join(import.meta.dirname, "..");
const lexPath = join(root, "content", "ca", "lexicon", "lexicon.json");
// Two authored sources, applied in order: the closed-class core, then the
// vocabulary the grammar course turned out to need.
const patchPaths = ["ca-closed-class.json", "ca-grammar-vocab.json"].map((f) =>
  join(root, "scripts", "data", f),
);

interface Entry {
  id: string;
  target: string;
  targetNormalized: string;
  glossEn: string;
  pos: string;
  freqRank: number;
  freqBand: number;
  register: string;
  variants: string[];
  exampleTarget: string;
  exampleEn: string;
  tags: string[];
  [k: string]: unknown;
}

interface PatchFile {
  delete: { target: string; why: string }[];
  rename: { from: string; to: string; why: string }[];
  patch: { target: string; glossEn?: string; addVariants: string[] }[];
  add: {
    target: string;
    pos: string;
    band: number;
    glossEn: string;
    variants: string[];
    exampleTarget: string;
    exampleEn: string;
  }[];
}

const file = JSON.parse(readFileSync(lexPath, "utf8")) as { entries: Entry[] };
const sources = patchPaths.map((p) => JSON.parse(readFileSync(p, "utf8")) as PatchFile);
const patch: PatchFile = {
  delete: sources.flatMap((s) => s.delete),
  rename: sources.flatMap((s) => s.rename),
  patch: sources.flatMap((s) => s.patch),
  add: sources.flatMap((s) => s.add),
};

const byTarget = new Map(file.entries.map((e) => [e.target, e]));
const log: string[] = [];

// --- delete ---------------------------------------------------------------
const doomed = new Set(patch.delete.map((d) => d.target));
for (const d of patch.delete) {
  if (!byTarget.has(d.target)) log.push(`delete: "${d.target}" not present (already gone)`);
}
let entries = file.entries.filter((e) => !doomed.has(e.target));
log.push(`deleted ${file.entries.length - entries.length} entries`);

// --- rename ---------------------------------------------------------------
for (const r of patch.rename) {
  const e = entries.find((x) => x.target === r.from);
  if (!e) {
    log.push(`rename: "${r.from}" not present`);
    continue;
  }
  if (entries.some((x) => x.target === r.to)) {
    log.push(`rename: "${r.to}" already exists, dropping "${r.from}" instead`);
    entries = entries.filter((x) => x !== e);
    continue;
  }
  // The plural stays reachable as a variant, so existing text still resolves.
  if (!e.variants.includes(r.from)) e.variants.push(r.from);
  e.target = r.to;
  e.targetNormalized = normalizeCatalan(r.to);
}

// --- patch ----------------------------------------------------------------
for (const p of patch.patch) {
  const e = entries.find((x) => x.target === p.target);
  if (!e) {
    log.push(`patch: "${p.target}" not present`);
    continue;
  }
  if (p.glossEn) e.glossEn = p.glossEn;
  for (const v of p.addVariants) if (!e.variants.includes(v)) e.variants.push(v);
}

// --- add ------------------------------------------------------------------
// New entries sort to the head of their band: these really are the most
// frequent words in the language, so a band-1 pronoun belongs before the
// band-1 nouns the generator produced, not after them.
const bandFloor = new Map<number, number>();
for (const e of entries) {
  const cur = bandFloor.get(e.freqBand);
  if (cur === undefined || e.freqRank < cur) bandFloor.set(e.freqBand, e.freqRank);
}

const added: Entry[] = [];
patch.add.forEach((a, i) => {
  if (entries.some((x) => x.target === a.target)) {
    log.push(`add: "${a.target}" already exists, skipped`);
    return;
  }
  const floor = bandFloor.get(a.band) ?? 1;
  added.push({
    id: `lx-new-${i}`,
    target: a.target,
    targetNormalized: normalizeCatalan(a.target),
    glossEn: a.glossEn,
    pos: a.pos,
    // Fractional for now; renumbered densely below.
    freqRank: floor - 1 + i / 10000,
    freqBand: a.band,
    register: "neutral",
    variants: a.variants,
    exampleTarget: a.exampleTarget,
    exampleEn: a.exampleEn,
    tags: ["closed-class"],
  });
});
entries = [...entries, ...added];
log.push(`added ${added.length} entries`);

// --- verify ---------------------------------------------------------------
// Same harness the audit runs, so nothing lands that a later audit would drop.
entries.sort((a, b) => a.freqRank - b.freqRank);
const seen = new Map<string, string>();
const kept: Entry[] = [];
const rejected: string[] = [];
for (const e of entries) {
  const candidate: CandidateEntry = {
    word: e.target,
    pos: e.pos,
    gloss: e.glossEn,
    example: e.exampleTarget,
    exampleEn: e.exampleEn,
  };
  const problems = verifyEntry(candidate, seen);
  if (problems.length) {
    rejected.push(`${e.target} (${e.pos}): ${problems.join("; ")}`);
    continue;
  }
  kept.push(e);
}

if (rejected.length) {
  console.error(`${rejected.length} entr(ies) failed verification:`);
  for (const r of rejected) console.error(`  ✗ ${r}`);
}

// --- renumber -------------------------------------------------------------
kept.forEach((e, i) => {
  e.freqRank = i + 1;
  e.id = `lx-${String(i + 1).padStart(4, "0")}`;
});

for (const l of log) console.log(`  ${l}`);
const bands: Record<number, number> = {};
for (const e of kept) bands[e.freqBand] = (bands[e.freqBand] ?? 0) + 1;
console.log(`\nentries: ${file.entries.length} -> ${kept.length}   bands: ${JSON.stringify(bands)}`);

if (write) {
  const out = JSON.parse(readFileSync(lexPath, "utf8"));
  out.entries = kept;
  writeFileSync(lexPath, JSON.stringify(out, null, 2) + "\n");
  console.log(`Wrote ${lexPath}`);
} else {
  console.log("(dry run - pass --write to apply)");
}

if (rejected.length) process.exit(1);
