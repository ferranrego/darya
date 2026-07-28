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
  const { error } = await db.from("lexemes").upsert(lexemeRows);
  if (error) throw new Error(`lexemes upsert: ${error.message}`);
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
  }));

{
  const { error } = await db.from("texts").upsert(textRows);
  if (error) throw new Error(`texts upsert: ${error.message}`);
  console.log(`seeded ${textRows.length} texts`);
}
