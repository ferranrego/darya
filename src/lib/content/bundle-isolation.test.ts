import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Keeps the 3.8 MB lexicon out of client bundles that do not need it.
 *
 * Measured on a production build before this existed: every authenticated
 * route downloaded a 3.56 MB (765 KB gzip) chunk holding the whole lexicon,
 * because the app shell imported `levels` from `load.ts` and that module parsed
 * the lexicon at import time. Nothing crashed and every page rendered - it was
 * only slow, which is exactly the kind of defect that comes back unnoticed.
 *
 * This is the cheap half of the guard, run by `pnpm test`. It only sees direct
 * imports; `scripts/check-bundle.ts` (run after `pnpm build`) checks the real
 * client-reference manifests, which catches transitive ones too.
 */

const ROOT = join(import.meta.dirname, "..", "..", "..");

/** Modules the app shell or Home reach; none of them may touch the lexicon. */
const SHELL_SAFE = [
  "src/app/(app)/layout.tsx",
  "src/components/tab-bar.tsx",
  "src/components/ui/milestone-observer.tsx",
  "src/lib/lexeme/lookup.ts",
  "src/lib/content/levels.ts",
  "src/lib/content/courses.ts",
  "src/lib/util/level-forecast.ts",
];

const LEXICON_IMPORT = /from\s+["'][^"']*(content\/lexicon|lexicon\.json|lexeme\/entry-for|content\/load)(\.ts)?["']/;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(name) && !name.endsWith(".test.ts")) out.push(full);
  }
  return out;
}

describe("lexicon bundle isolation", () => {
  it.each(SHELL_SAFE)("%s does not import the lexicon", (file) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    expect(src).not.toMatch(LEXICON_IMPORT);
  });

  it("no client component imports the content barrel", () => {
    const offenders = walk(join(ROOT, "src"))
      .filter((f) => /^\s*["']use client["']/.test(readFileSync(f, "utf8")))
      .filter((f) => /from\s+["'][^"']*content\/load(\.ts)?["']/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(ROOT.length + 1));
    expect(offenders).toEqual([]);
  });
});
