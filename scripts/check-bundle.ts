/**
 * Post-build guard: the lexicon chunk may only reach routes that resolve words.
 *
 * Before this existed, a Zod-parsed 3.8 MB `lexicon.json` shipped in one
 * 3.56 MB (765 KB gzip) client chunk that all 23 authenticated routes loaded -
 * Home, Chat and Leaderboard included - plus a second copy on /onboarding. The
 * app shell imported `levels` from a module that also parsed the lexicon. The
 * build was green and every page rendered; it was only slow.
 *
 * It reads what Next actually ships: each route's
 * `page_client-reference-manifest.js` lists the client chunks that route loads.
 * A route outside ALLOWED that references the lexicon chunk fails the build, as
 * does any route over the raw-bytes BUDGET. Run with `pnpm check:bundle`; it
 * also runs as `postbuild`.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const NEXT = join(import.meta.dirname, "..", ".next");
const CHUNKS = join(NEXT, "static", "chunks");
const APP = join(NEXT, "server", "app");

/** Routes that genuinely resolve lexicon entries at render time. */
const ALLOWED = new Set([
  "(app)/read",
  "(app)/read/[id]",
  "(app)/read/import/[id]",
  "(app)/review",
  "(app)/words",
  "onboarding",
]);

/**
 * Raw client JS per route outside ALLOWED, in bytes. Ratchet down, never up
 * without a reason in the commit message.
 *
 * Measured after the split: the shell routes (leaderboard, profile, history)
 * land near 845 KB, and the routes that draw the grammar course (Home, Grammar,
 * Journey, Alphabet, Stats, Grammar Hub) near 1.15-1.33 MB because
 * `grammar/all.json` is 596 KB of it. The lexicon chunk alone is 3.56 MB, so
 * this budget still catches it arriving by any path the manifest scan misses.
 */
const BUDGET = 1_400_000;

/** A chunk carrying the lexicon has thousands of `freqRank` keys; nothing else does. */
const LEXICON_MIN_HITS = 5_000;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name === "page_client-reference-manifest.js") out.push(full);
  }
  return out;
}

if (!existsSync(CHUNKS) || !existsSync(APP)) {
  console.error("check-bundle: no .next build output found - run `pnpm build` first.");
  process.exit(1);
}

const lexiconChunks = new Set(
  readdirSync(CHUNKS)
    .filter((f) => f.endsWith(".js"))
    .filter((f) => (readFileSync(join(CHUNKS, f), "utf8").match(/freqRank/g)?.length ?? 0) >= LEXICON_MIN_HITS),
);

// Loud rather than vacuous: if the lexicon stops looking like this, every
// route would "pass" while the check measured nothing.
if (lexiconChunks.size === 0) {
  console.error(
    "check-bundle: could not find the lexicon chunk (no chunk with " +
      `${LEXICON_MIN_HITS}+ \`freqRank\` keys). The detection is stale - update it.`,
  );
  process.exit(1);
}

const rows: { route: string; bytes: number; lexicon: boolean }[] = [];
for (const manifest of walk(APP)) {
  const route = relative(APP, manifest).replace(/\/page_client-reference-manifest\.js$/, "").replace(/^page_client-reference-manifest\.js$/, "");
  const src = readFileSync(manifest, "utf8");
  const chunks = new Set([...src.matchAll(/static\/chunks\/([^"'\\]+\.js)/g)].map((m) => m[1]));
  let bytes = 0;
  let lexicon = false;
  for (const c of chunks) {
    const p = join(CHUNKS, c);
    if (existsSync(p)) bytes += statSync(p).size;
    if (lexiconChunks.has(c)) lexicon = true;
  }
  rows.push({ route: route.replace(/\/page$/, "") || "/", bytes, lexicon });
}
rows.sort((a, b) => a.route.localeCompare(b.route));

const failures: string[] = [];
console.log("\nClient JS per route (raw):");
for (const r of rows) {
  const allowed = ALLOWED.has(r.route);
  const flag = r.lexicon ? (allowed ? "lexicon (allowed)" : "LEXICON - NOT ALLOWED") : "";
  console.log(`  ${(r.bytes / 1024).toFixed(0).padStart(6)} KB  ${r.route.padEnd(32)} ${flag}`);
  if (r.lexicon && !allowed) failures.push(`${r.route} loads the lexicon chunk`);
  if (!allowed && r.bytes > BUDGET) failures.push(`${r.route} is ${r.bytes} B, over the ${BUDGET} B budget`);
}

if (failures.length > 0) {
  console.error("\ncheck-bundle FAILED:\n  " + failures.join("\n  "));
  console.error("\nImport the narrow module (content/levels, content/courses) instead of content/load or content/lexicon.");
  process.exit(1);
}
console.log(`\ncheck-bundle: ok (${rows.length} routes, lexicon confined to ${ALLOWED.size} allowed routes)\n`);
