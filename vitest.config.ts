import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Content is namespaced per language (`content/<lang>/…`) and reached through
 * the `@content` alias. The Next build points it at the `content/active`
 * symlink, written from NEXT_PUBLIC_TARGET_LANG by scripts/link-content.ts.
 *
 * Vitest resolves the same variable but **must not go through that symlink**.
 * The symlink is one shared piece of filesystem state while the variable is
 * per-process, so a test run in one language silently re-points the content
 * under a dev server running in the other: the Dari app keeps its Dari
 * branding, layout direction and prompts, and starts serving the Catalan
 * lexicon. Nothing errors - the two halves just quietly stop matching.
 *
 * Resolving straight from the variable gives the test run its own view of the
 * content and leaves the symlink alone, which is what the `pretest` hook used
 * to fight over.
 */
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const DEFAULT_LANG = "prs";
const lang = process.env.NEXT_PUBLIC_TARGET_LANG || DEFAULT_LANG;

/**
 * Checks that hit the live provider chain cost API quota, so they stay out of
 * `pnpm test` - but they have to be *runnable*, and naming them in `exclude`
 * meant they were not: vitest applies the exclusion even when the file is passed
 * explicitly, so the command in generate-smoke.test.ts's own header answered
 * "No test files found". Gating on an env var keeps them off the default run and
 * lets `LIVE_AI=1` ask for them by name.
 */
const liveExclusions = process.env.LIVE_AI ? [] : ["**/*.live.test.ts"];

export default defineConfig({
  test: { exclude: ["**/node_modules/**", ...liveExclusions] },
  resolve: {
    alias: {
      "server-only": r("./test/server-only-stub.ts"),
      "@content": r(`./content/${lang}`),
      "@": r("./src"),
    },
  },
});
