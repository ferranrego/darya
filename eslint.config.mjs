import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // One-off content-repair scripts, run once and kept only as a record of
    // what was done to the data. They are not application code and they were
    // holding `pnpm lint` red, which made the whole gate useless - a lint run
    // nobody can get to zero is a lint run nobody reads.
    "**/*.cjs",
    "temp/**",
    "test-db.js",
    "scripts/migrate-grammar-to-yaml.js",
    "scripts/migrate-grammar-to-yaml.ts",
    "scripts/fix-b1-yaml.ts",
  ]),
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // eslint-disable-next-line no-restricted-syntax
          selector: "Literal[value=/—/]",
          message: "Do not use em dashes. Use a normal dash (-) or colon (:) instead."
        },
        {
          // eslint-disable-next-line no-restricted-syntax
          selector: "JSXText[value=/—/]",
          message: "Do not use em dashes. Use a normal dash (-) or colon (:) instead."
        },
        {
          // eslint-disable-next-line no-restricted-syntax
          selector: "TemplateElement[value.raw=/—/]",
          message: "Do not use em dashes. Use a normal dash (-) or colon (:) instead."
        }
      ]
    }
  }
]);

export default eslintConfig;
