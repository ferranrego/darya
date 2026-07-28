import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * Resolve which language's content a script should operate on.
 *
 * Content is namespaced per language (`content/<lang>/…`) so one repository can
 * build more than one app. Scripts pick the language from `--lang <code>`, then
 * `NEXT_PUBLIC_TARGET_LANG`, then the default - the same variable the Next build
 * uses for its `@content` alias, so `pnpm validate:content` and `pnpm build`
 * cannot disagree about which content they are looking at.
 *
 * `content/schema/` is deliberately NOT namespaced: the schemas are shared
 * across languages and are what makes them interchangeable.
 */

const DEFAULT_LANG = "prs";

export function targetLang(argv: string[] = process.argv): string {
  const flag = argv.indexOf("--lang");
  if (flag !== -1 && argv[flag + 1]) return argv[flag + 1];
  return process.env.NEXT_PUBLIC_TARGET_LANG || DEFAULT_LANG;
}

/** Absolute path to the active language's content directory. */
export function contentRoot(argv: string[] = process.argv): string {
  const lang = targetLang(argv);
  const root = join(import.meta.dirname, "..", "content", lang);
  if (!existsSync(root)) {
    throw new Error(
      `No content for language "${lang}" (looked in ${root}). ` +
        `Pass --lang <code> or set NEXT_PUBLIC_TARGET_LANG.`,
    );
  }
  return root;
}

/** Absolute path to the shared, language-independent schema directory. */
export function schemaRoot(): string {
  return join(import.meta.dirname, "..", "content", "schema");
}
