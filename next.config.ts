import type { NextConfig } from "next";

/**
 * The language this build teaches. Must match a directory under `content/` and
 * a profile in `src/lib/lang/`. One deployment serves exactly one language.
 */
const TARGET_LANG = process.env.NEXT_PUBLIC_TARGET_LANG ?? "prs";

const nextConfig: NextConfig = {
  turbopack: {
    root: "./",
    /**
     * `@content` resolves to the active language's content directory.
     *
     * The alternative - importing `content/<lang>/…` directly - would bundle
     * every language's JSON into every build. The lexicon alone is 3.3 MB, and
     * it ships in the client bundle so the reader needs no network round-trip,
     * so only the active language may be resolvable. Keeping the imports static
     * (rather than dynamic by code) preserves tree-shaking.
     *
     * tsconfig `paths` points `@content/*` at `content/prs/*` for the type
     * checker; the schemas are shared, so the shapes match whichever language
     * a given build actually resolves.
     */
    resolveAlias: {
      "@content": `./content/${TARGET_LANG}`,
    },
  },
};

export default nextConfig;
