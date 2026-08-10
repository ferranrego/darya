/**
 * Seed the Supabase DB from content/ (lexicon + seed texts).
 * Idempotent: upserts by ID; safe to re-run after content changes.
 *
 * Run: pnpm seed   (uses .env.local via node --env-file)
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  lexiconFileSchema,
  textDocumentSchema,
} from "../src/lib/content/schema.ts";
import { contentRoot } from "./content-path.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");

const db = createClient(url, secret, { auth: { persistSession: false } });
const root = contentRoot();

// --- lexemes ---------------------------------------------------------------
const lexicon = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
);
const lexemeRows = lexicon.entries.map((e) => ({
  id: e.id,
  target: e.target,
  target_normalized: e.targetNormalized,
  translit: e.translit,
  gloss_en: e.glossEn,
  pos: e.pos,
  freq_rank: e.freqRank,
  freq_band: e.freqBand,
  register: e.register,
  variants: e.variants,
  example_target: e.exampleTarget,
  example_translit: e.exampleTranslit,
  example_en: e.exampleEn,
  audio_url: e.audioUrl ?? null,
  tags: e.tags,
}));

{
  // Chunked, so a rejected row costs one batch rather than the whole seed.
  // As one statement, a single constraint violation anywhere in six thousand
  // rows aborted everything and left the table holding the previous
  // vocabulary - which reads as "the seed did nothing" rather than as an
  // error about one row, and is how a stale lexicon can outlive a content
  // rebuild.
  const CHUNK = 500;
  for (let i = 0; i < lexemeRows.length; i += CHUNK) {
    const batch = lexemeRows.slice(i, i + CHUNK);
    const { error } = await db.from("lexemes").upsert(batch);
    if (error) {
      throw new Error(
        `lexemes upsert failed on rows ${i}-${i + batch.length - 1} ` +
          `(${batch[0]?.id}…${batch.at(-1)?.id}): ${error.message}`,
      );
    }
  }
  console.log(`seeded ${lexemeRows.length} lexemes`);
}

// --- seed texts ------------------------------------------------------------
const seedDir = join(root, "texts", "seed");
const textRows = readdirSync(seedDir)
  .filter((f) => f.endsWith(".json"))
  .map((f) => textDocumentSchema.parse(JSON.parse(readFileSync(join(seedDir, f), "utf8"))))
  .map((doc) => ({
    id: doc.id,
    level: doc.level,
    vocab_hash: null,
    source: doc.source,
    doc,
    // Mirrored onto its own column so getTextsForLevel can sort in SQL
    // without parsing the JSONB doc - see the 20260808000000 migration.
    seq: doc.seq ?? null,
  }));

{
  const { error } = await db.from("texts").upsert(textRows);
  if (error) throw new Error(`texts upsert: ${error.message}`);
  console.log(`seeded ${textRows.length} texts`);
}
