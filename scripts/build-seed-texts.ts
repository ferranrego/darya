/**
 * Tokenize seed text sources against the lexicon and write TextDocument JSON
 * files to content/texts/seed/. Fails if any word cannot be resolved - add the
 * word to the lexicon rather than weakening this check.
 *
 * Run: pnpm build:texts (after pnpm build:lexicon)
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTENT_FORMAT_VERSION,
  lexiconFileSchema,
  textDocumentSchema,
  type TextDocument,
} from "../src/lib/content/schema.ts";
import { buildIndex } from "../src/lib/text/index.ts";
import { tokenize } from "../src/lib/text/index.ts";
import { seedTexts } from "./data/seed-texts.ts";

const root = join(import.meta.dirname, "..");
const lexicon = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(root, "content", "lexicon", "lexicon.json"), "utf8")),
);
const index = buildIndex(lexicon.entries);

const outDir = join(root, "content", "texts", "seed");
mkdirSync(outDir, { recursive: true });

const failures: string[] = [];

for (const source of seedTexts) {
  const vocab = new Set<string>();
  const sentences = source.sentences.map((s) => {
    const tokens = tokenize(s.target).map((surface) => {
      const entry = index.resolve(surface);
      if (!entry) failures.push(`${source.slug}: unresolved word "${surface}" in "${s.target}"`);
      else vocab.add(entry.id);
      return { surface, lexemeId: entry?.id ?? null };
    });
    return { ...s, tokens };
  });

  const doc: TextDocument = {
    id: `tx-seed-${source.slug}`,
    formatVersion: CONTENT_FORMAT_VERSION,
    level: source.level,
    titleTarget: source.titleTarget,
    titleTranslit: source.titleTranslit,
    titleEn: source.titleEn,
    sentences,
    vocabUsed: [...vocab].sort(),
    newWordRatio: 0,
    source: "seed",
    createdAt: "2026-07-20T00:00:00.000Z",
  };

  textDocumentSchema.parse(doc);
  writeFileSync(join(outDir, `${doc.id}.json`), JSON.stringify(doc, null, 2) + "\n");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`wrote ${seedTexts.length} seed texts to content/texts/seed/`);
