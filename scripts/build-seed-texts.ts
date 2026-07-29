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
import { PROFILES } from "../src/lib/lang/index.ts";
import { contentRoot, targetLang } from "./content-path.ts";

const lang = targetLang();
const langProfile = PROFILES[lang as keyof typeof PROFILES];
if (!langProfile) throw new Error(`No language profile for "${lang}"`);
// The selected language's engine, not the environment's - see validate-content.
const { buildIndex, tokenize } = langProfile.text;

const { seedTexts } = (await import(`./data/seed-texts-${lang}.ts`)) as {
  seedTexts: import("./data/seed-texts-prs.ts").SeedTextSource[];
};

const lexicon = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(contentRoot(), "lexicon", "lexicon.json"), "utf8")),
);
const index = buildIndex(lexicon.entries);

const outDir = join(contentRoot(), "texts", "seed");
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
