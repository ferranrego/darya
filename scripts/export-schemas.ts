/**
 * Export Zod content schemas to JSON Schema files in content/schema/.
 * Run: pnpm export:schemas
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import {
  alphabetCourseSchema,
  grammarCourseSchema,
  lexiconFileSchema,
  levelsFileSchema,
  textDocumentSchema,
} from "../src/lib/content/schema.ts";

const outDir = join(import.meta.dirname, "..", "content", "schema");
mkdirSync(outDir, { recursive: true });

const targets: Array<[string, z.ZodType]> = [
  ["lexicon", lexiconFileSchema],
  ["alphabet-course", alphabetCourseSchema],
  ["grammar-course", grammarCourseSchema],
  ["levels", levelsFileSchema],
  ["text-document", textDocumentSchema],
];

for (const [name, schema] of targets) {
  const json = z.toJSONSchema(schema, { target: "draft-2020-12" });
  const file = join(outDir, `${name}.schema.json`);
  writeFileSync(file, JSON.stringify(json, null, 2) + "\n");
  console.log(`wrote content/schema/${name}.schema.json`);
}
