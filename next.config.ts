import type { NextConfig } from "next";

/**
 * Content is selected by the `content/active` symlink, written by
 * scripts/link-content.ts from NEXT_PUBLIC_TARGET_LANG before every build.
 *
 * It used to be a turbopack `resolveAlias` here, which silently lost to
 * tsconfig `paths`: the Catalan build shipped the Dari lexicon while reporting
 * success. A symlink is resolved identically by every tool, so there is nothing
 * left to disagree about.
 */
const nextConfig: NextConfig = {
  turbopack: {
    root: "./",
  },
};

export default nextConfig;
