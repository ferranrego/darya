/**
 * Build content/lexicon/lexicon.json from the pipe-delimited core data files
 * in scripts/data/core-lexicon-*.txt.
 *
 * Line format:
 * rank|dari|translit|pos|register|glossEn|exampleDari|exampleTranslit|exampleEn|tags|variants
 *
 * Run: pnpm build:lexicon
 */
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTENT_FORMAT_VERSION,
  lexiconFileSchema,
  type LexiconEntry,
} from "../src/lib/content/schema.ts";
import { normalizeDari } from "../src/lib/text/normalize.ts";

const dataDir = join(import.meta.dirname, "data");
const outDir = join(import.meta.dirname, "..", "content", "lexicon");

const BAND_BOUNDS = [100, 250, 500, 800, 1200, 1700, 2400] as const;
function bandForRank(rank: number): number {
  const i = BAND_BOUNDS.findIndex((b) => rank <= b);
  return i === -1 ? 8 : i + 1;
}

const files = readdirSync(dataDir)
  .filter((f) => /^core-lexicon-\d+\.txt$/.test(f))
  .sort();

const entries: LexiconEntry[] = [];
let n = 0;

for (const file of files) {
  const lines = readFileSync(join(dataDir, file), "utf8").split("\n");
  for (const [lineNo, raw] of lines.entries()) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const parts = line.split("|");
    if (parts.length !== 11) {
      throw new Error(`${file}:${lineNo + 1}: expected 11 fields, got ${parts.length}`);
    }
    const [rank, dari, translit, pos, register, glossEn, exampleDari, exampleTranslit, exampleEn, tags, variants] = parts;
    n++;
    entries.push({
      id: `lx-${String(n).padStart(4, "0")}`,
      dari: normalizeDari(dari),
      dariNormalized: normalizeDari(dari),
      translit,
      glossEn,
      pos: pos as LexiconEntry["pos"],
      freqRank: Number(rank),
      freqBand: bandForRank(Number(rank)),
      register: register as LexiconEntry["register"],
      variants: variants ? variants.split(",").map((v) => normalizeDari(v)) : [],
      exampleDari,
      exampleTranslit,
      exampleEn,
      tags: tags ? tags.split(",") : [],
    });
  }
}

entries.sort((a, b) => a.freqRank - b.freqRank);

const doc = {
  formatVersion: CONTENT_FORMAT_VERSION,
  language: "prs" as const,
  glossLanguage: "en" as const,
  license: "CC BY-SA 4.0",
  entries,
};

const parsed = lexiconFileSchema.parse(doc);
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "lexicon.json"), JSON.stringify(parsed, null, 2) + "\n");
console.log(`wrote content/lexicon/lexicon.json (${entries.length} entries)`);
