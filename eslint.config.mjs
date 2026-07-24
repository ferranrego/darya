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
  ]),
  {
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          // eslint-disable-next-line no-restricted-syntax
          selector: "Literal[value=/—/]",
          // eslint-disable-next-line no-restricted-syntax
          message: "Do not use em dashes (—). Use a normal dash (-) or colon (:) instead."
        },
        {
          // eslint-disable-next-line no-restricted-syntax
          selector: "JSXText[value=/—/]",
          // eslint-disable-next-line no-restricted-syntax
          message: "Do not use em dashes (—). Use a normal dash (-) or colon (:) instead."
        },
        {
          // eslint-disable-next-line no-restricted-syntax
          selector: "TemplateElement[value.raw=/—/]",
          // eslint-disable-next-line no-restricted-syntax
          message: "Do not use em dashes (—). Use a normal dash (-) or colon (:) instead."
        }
      ]
    }
  }
]);

export default eslintConfig;
