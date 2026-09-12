/**
 * Apply a philologist's verdicts on whether the dictionary teaches Dari that
 * Kabul actually speaks.
 *
 * The audit that feeds this asks one question per entry: would an ordinary
 * person in Kabul use this word, for this meaning, in everyday speech? Three
 * things made that question unanswerable by machine, and they are why the
 * repairs arrive as a reviewed file rather than as a rule:
 *
 *  - The only Afghan-vs-Iranian knowledge in the repo is nine hardcoded pairs
 *    in `INTERFERENCE_RULES`, against 6,466 entries.
 *  - `register` is a formality axis, not a variety one. 1,524 of the 1,768
 *    entries a beginner meets are `neutral`, which is the default bucket, so
 *    it conflates "everyday Kabuli" with "Iranian word nobody here says".
 *  - The validator's Iranian check reads example sentences, never headwords.
 *
 *   Apply: node scripts/repair-lexicon-register.ts --apply <file> [--dry-run]
 *
 * The file is the audit's own output - an array of
 * `{ id, verdict, preferred?, why?, confidence? }`.
 *
 * An `iranian` verdict never deletes the entry. `user_words.lexeme_id` is a
 * foreign key and cached texts store `lexemeId` in their JSON, so dropping one
 * orphans real learner progress (CLAUDE.md rule 4). Instead the gloss is
 * rewritten in the `[not a headword: …]` shape that `isRuledOut` already
 * understands: the entry leaves the teaching pool and the placement grid, and
 * stays resolvable for lookup - which imported Iranian text needs, because a
 * learner tapping a word in an article must still get an answer.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema, type LexiconEntry } from "../src/lib/content/schema.ts";
import { isRuledOut } from "../src/lib/content/teachability.ts";
import { contentRoot } from "./content-path.ts";

type Verdict = "iranian" | "bookish" | "register-wrong" | "missing-counterpart";

interface Finding {
  id: string;
  verdict: Verdict;
  /** The Dari word a Kabuli would use instead. Required for iranian/bookish. */
  preferred?: string;
  why?: string;
  confidence?: string;
  /** For `register-wrong` only: what the register should become. */
  register?: LexiconEntry["register"];
}

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? "");
};
const file = flag("--apply");
const dryRun = args.includes("--dry-run");
if (!file) {
  console.error("usage: repair-lexicon-register.ts --apply <findings.json> [--dry-run]");
  process.exit(1);
}

const root = contentRoot();
const lexPath = join(root, "lexicon", "lexicon.json");
const raw = JSON.parse(readFileSync(lexPath, "utf8")) as { entries: LexiconEntry[] };
const byId = new Map(raw.entries.map((e) => [e.id, e]));

const findings = JSON.parse(readFileSync(file, "utf8")) as Finding[];
if (!Array.isArray(findings)) throw new Error(`${file}: expected an array of findings`);

const problems: string[] = [];
const seen = new Set<string>();
for (const [i, f] of findings.entries()) {
  const where = `findings[${i}] ${f.id ?? "?"}`;
  const entry = f.id ? byId.get(f.id) : undefined;
  // `missing-counterpart` names a word that is absent, so it has no entry to
  // repair - it is a request to author one, which `add-lexicon-entries.ts`
  // does. Reported here rather than silently skipped.
  if (f.verdict === "missing-counterpart") continue;
  if (!entry) problems.push(`${where}: no such entry`);
  if (seen.has(f.id)) problems.push(`${where}: named twice`);
  seen.add(f.id);
  if ((f.verdict === "iranian" || f.verdict === "bookish") && !f.preferred) {
    problems.push(`${where}: ${f.verdict} needs the Dari word to prefer instead`);
  }
  if (f.verdict === "register-wrong" && !f.register) {
    problems.push(`${where}: register-wrong needs the register it should become`);
  }
  if (entry && isRuledOut(entry)) {
    problems.push(`${where}: already ruled out - "${entry.glossEn}"`);
  }
  /**
   * A `preferred` that names the entry's own headword is a different finding.
   *
   * گیلاس came back as `iranian` with preferred "گیلاس = drinking glass
   * (cherry is آلبالو)" - the auditor meant the *gloss* carries the Iranian
   * sense, not that the word is Iranian. Applied literally this wrote "Dari is
   * گیلاس" onto گیلاس and ruled a genuinely Afghan word out of the course.
   * This tool can only say "prefer a different word"; a wrong gloss is a
   * repair it cannot express, so it refuses rather than mangles.
   */
  if (entry && f.preferred?.includes(entry.targetNormalized)) {
    problems.push(
      `${where}: preferred names the headword itself ("${f.preferred}") - ` +
        `this reads as a wrong-gloss finding, which this tool cannot apply`,
    );
  }
}
if (problems.length > 0) {
  for (const p of problems.slice(0, 30)) console.error(`✗ ${p}`);
  if (problems.length > 30) console.error(`  … ${problems.length - 30} more`);
  console.error(`\n${problems.length} problem(s); nothing written`);
  process.exit(1);
}

let ruledOut = 0;
let noted = 0;
let reregistered = 0;
const wanted: Finding[] = [];
for (const f of findings) {
  if (f.verdict === "missing-counterpart") {
    wanted.push(f);
    continue;
  }
  const e = byId.get(f.id)!;
  if (f.verdict === "iranian") {
    // The gloss carries the reason, because it is the only thing a person
    // reading the diff - or the entry, later - will actually see.
    e.glossEn = `[not a headword: Iranian; Dari is ${f.preferred}] ${e.glossEn}`;
    ruledOut++;
  } else if (f.verdict === "bookish") {
    /**
     * A bookish word is not ruled out, because it is correct Dari.
     *
     * The auditors were clear that the defect here is usually the *band*, not
     * the word: گوهر سفتن is real Dari that a corpus ranked as beginner
     * vocabulary because the corpora available are Iranian-dominated. So the
     * entry keeps its place and gets told the truth about itself - the gloss
     * names the everyday word, and the register stops claiming to be neutral.
     */
    if (!e.glossEn.includes(f.preferred!)) {
      e.glossEn = `${e.glossEn} (everyday Dari is ${f.preferred})`;
    }
    if (e.register === "neutral") e.register = "formal";
    noted++;
  } else if (f.verdict === "register-wrong") {
    e.register = f.register!;
    reregistered++;
  }
}

// Re-parse rather than trust the edits: a repair that breaks the schema should
// fail here, not in the build of whatever reads the lexicon next.
const parsed = lexiconFileSchema.safeParse(raw);
if (!parsed.success) {
  console.error("✗ the repaired lexicon no longer matches its schema:");
  for (const issue of parsed.error.issues.slice(0, 5)) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

console.log(`ruled out of teaching: ${ruledOut}`);
console.log(`bookish, gloss noted:    ${noted}`);
console.log(`register corrected:    ${reregistered}`);
if (wanted.length > 0) {
  console.log(`\n${wanted.length} everyday Dari word(s) the dictionary is missing - author with add-lexicon-entries.ts:`);
  for (const f of wanted) console.log(`  ${f.preferred ?? "?"}  (${f.why ?? ""})`);
}
if (dryRun) {
  console.log("\n(dry run, nothing written)");
  process.exit(0);
}
writeFileSync(lexPath, JSON.stringify(raw, null, 2) + "\n");
console.log(`\nwrote ${lexPath} - now run: node scripts/lexicon-diff.ts && pnpm validate:content`);
