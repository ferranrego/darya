/**
 * One-off: rename the language-neutral DATA fields from `dari*` to `target*`.
 *
 * Phase 1 of making this codebase serve more than one target language. The
 * field holding "the text in the language being learned" is not a Dari concept,
 * so it should not be called `dari`. Renaming it now, before any second
 * language exists, keeps it a single mechanical commit.
 *
 * Deliberately NOT renamed: normalizeDari, tokenizeDari, isDari, DARI_SCRIPT
 * and prose mentions of "Dari". Those encode genuinely Persian-specific
 * behaviour (ی/ک folding, ZWNJ rejoining, Arabic-block detection). Calling them
 * `normalizeTarget` while they still do Persian-only work would be more
 * misleading, not less - Phase 2 relocates them into src/lib/lang/prs/ behind
 * the LanguageProfile interface, which is where they stop being visible.
 *
 * Covers three surfaces that must move together:
 *   1. content/ JSON keys           (structural rewrite, key names only)
 *   2. src/ + scripts/ identifiers  (including LLM prompt JSON shapes, which
 *                                    typecheck cannot catch)
 *   3. SQL columns                  (via a separate migration, not this script)
 *
 * Run: node scripts/rename-dari-to-target.ts [--dry-run]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dryRun = process.argv.includes("--dry-run");
const root = join(import.meta.dirname, "..");

/** Longest / most specific first; the bare `dari` rule must run last. */
const RENAMES: Array<[string, string]> = [
  ["incorrectSentenceDari", "incorrectSentenceTarget"],
  ["correctSentenceDari", "correctSentenceTarget"],
  ["distractorsDari", "distractorsTarget"],
  ["setSelectedDari", "setSelectedTarget"],
  ["dariNormalized", "targetNormalized"],
  ["dari_normalized", "target_normalized"],
  ["maxDariLength", "maxTargetLength"],
  ["sentenceDari", "sentenceTarget"],
  ["selectedDari", "selectedTarget"],
  ["dariPreview", "targetPreview"],
  ["exampleDari", "exampleTarget"],
  ["example_dari", "example_target"],
  ["context_dari", "context_target"],
  ["collectDari", "collectTarget"],
  ["dariBefore", "targetBefore"],
  ["titleDari", "titleTarget"],
  ["dariAfter", "targetAfter"],
  ["wordDari", "wordTarget"],
  ["dariText", "targetText"],
  ["dariSeen", "targetSeen"],
  ["dariSide", "targetSide"],
  ["dariKey", "targetKey"],
  ["toDari", "toTarget"],
];

/** Key map for JSON content (data fields only). */
const JSON_KEYS = new Map(
  RENAMES.filter(([from]) => !from.includes("_")).concat([["dari", "target"]]),
);

function renameJsonKeys(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(renameJsonKeys);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    out[JSON_KEYS.get(key) ?? key] = renameJsonKeys(value);
  }
  return out;
}

function walk(dir: string, match: RegExp, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, match, out);
    else if (match.test(name)) out.push(path);
  }
  return out;
}

// --- 1. content JSON -------------------------------------------------------
let contentChanged = 0;
for (const path of walk(join(root, "content"), /\.json$/)) {
  const before = readFileSync(path, "utf8");
  const after = JSON.stringify(renameJsonKeys(JSON.parse(before)), null, 2) + "\n";
  if (before === after) continue;
  contentChanged++;
  if (!dryRun) writeFileSync(path, after);
}
console.log(`content JSON files rewritten: ${contentChanged}`);

// --- 2. code ---------------------------------------------------------------
// The bare rule refuses to match inside a longer word OR across a hyphen, so
// `dari-forms.ts`, `dariapp` and `normalizeDari` are all left alone.
const BARE = /(?<![\w-])dari(?![\w-])/g;

let codeChanged = 0;
const perFile: Array<[string, number]> = [];
for (const path of [
  ...walk(join(root, "src"), /\.tsx?$/),
  ...walk(join(root, "scripts"), /\.tsx?$/),
]) {
  if (path.endsWith("rename-dari-to-target.ts")) continue;
  const before = readFileSync(path, "utf8");
  let after = before;
  for (const [from, to] of RENAMES) {
    after = after.replace(new RegExp(`(?<![\\w-])${from}(?![\\w-])`, "g"), to);
  }
  after = after.replace(BARE, "target");
  if (before === after) continue;
  const hits = before.split(/\r?\n/).filter((l, i) => l !== after.split(/\r?\n/)[i]).length;
  perFile.push([path.slice(root.length + 1), hits]);
  codeChanged++;
  if (!dryRun) writeFileSync(path, after);
}
console.log(`code files rewritten: ${codeChanged}`);
for (const [file, hits] of perFile.sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`   ${String(hits).padStart(4)}  ${file}`);
}

console.log(dryRun ? "\n[dry-run] no changes written" : "\nDone.");
