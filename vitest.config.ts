import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Content is namespaced per language (`content/<lang>/…`) and reached through
 * the `@content` alias, which the Next build resolves from
 * NEXT_PUBLIC_TARGET_LANG (see next.config.ts) and tsconfig maps for the type
 * checker. Vitest needs the same alias, resolved from the same variable, so a
 * test run and a build can never disagree about which language they are
 * exercising.
 */
const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@content": r("./content/active"),
      "@": r("./src"),
    },
  },
});
