/**
 * Measure `topicsForToken` against real content (CLAUDE.md rule 1: measure,
 * don't just read the code and conclude it works).
 *
 * Tokenizes every seed text, resolves each token through the same lexicon
 * index the reader uses, runs `topicsForToken`, and prints per-slug counts
 * plus samples so a wrong link can actually be seen and caught before it
 * ships in the word sheet.
 *
 * Usage: node scripts/measure-grammar-topics.ts
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { grammarHubFileSchema, lexiconFileSchema, textDocumentSchema } from "../src/lib/content/schema.ts";
import { buildLexiconIndex } from "../src/lib/lang/prs/lexicon-index.ts";
import { tokenizeDari } from "../src/lib/lang/prs/normalize.ts";
import { topicsForToken } from "../src/lib/lang/prs/grammar-topics.ts";
import { contentRoot } from "./content-path.ts";

const SAMPLES_PER_SLUG = 10;

const root = contentRoot();

const lexicon = lexiconFileSchema.parse(JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")));
const index = buildLexiconIndex(lexicon.entries);

const hub = grammarHubFileSchema.parse(
  JSON.parse(readFileSync(join(root, "grammar-hub", "entries.json"), "utf8")),
);
const hubSlugs = new Set(hub.entries.map((e) => e.slug));

interface Sample {
  surface: string;
  headword: string;
  sentence: string;
  file: string;
}

const counts = new Map<string, number>();
const samples = new Map<string, Sample[]>();

function record(slug: string, sample: Sample) {
  counts.set(slug, (counts.get(slug) ?? 0) + 1);
  const list = samples.get(slug) ?? [];
  if (list.length < SAMPLES_PER_SLUG) list.push(sample);
  samples.set(slug, list);
}

const seedDir = join(root, "texts", "seed");
let textCount = 0;
let tokenCount = 0;

if (existsSync(seedDir)) {
  for (const file of readdirSync(seedDir).filter((n) => n.endsWith(".json"))) {
    const parsed = textDocumentSchema.safeParse(JSON.parse(readFileSync(join(seedDir, file), "utf8")));
    if (!parsed.success) continue; // schema errors are validate-content's own job
    textCount++;
    for (const sentence of parsed.data.sentences) {
      for (const surface of tokenizeDari(sentence.target)) {
        tokenCount++;
        const entry = index.resolve(surface);
        const topics = topicsForToken(surface, entry).filter((slug) => hubSlugs.has(slug));
        for (const slug of topics) {
          record(slug, { surface, headword: entry?.targetNormalized ?? "(unresolved)", sentence: sentence.target, file });
        }
      }
    }
  }
}

console.log(`${textCount} seed text(s), ${tokenCount} token(s) tokenized.\n`);

const slugsInOrder = [...counts.keys()].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
if (slugsInOrder.length === 0) {
  console.log("No tokens produced a grammar chip.");
} else {
  for (const slug of slugsInOrder) {
    console.log(`${slug}: ${counts.get(slug)} token(s) get a chip`);
    for (const s of samples.get(slug) ?? []) {
      console.log(`  ${s.surface}  ->  ${s.headword}   ("${s.sentence}", ${s.file})`);
    }
    console.log();
  }
}
