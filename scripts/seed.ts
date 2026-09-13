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
/**
 * Only the id reaches the database.
 *
 * The app never reads this table - it builds its dictionary from the bundled
 * `lexicon.json`. The table exists for one job: `assert_lexeme_ref` rejects a
 * `user_words` or `review_logs` row pointing at a word the app does not ship,
 * and that trigger reads `lexemes.id` and nothing else.
 *
 * It used to hold a full copy of every entry - word, gloss, examples, spelling,
 * frequency - which nothing read, and a copy that has to be kept in step by
 * hand eventually is not. It drifted once to 6,033 rows against 5,997 in the
 * file, and a learner ended up with flashcards `lexemeById` could not find and
 * so could never review. Storing only the id leaves nothing to drift.
 */
const lexemeRows = lexicon.entries.map((e) => ({ id: e.id }));

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

  /**
   * Seed texts in the database with no source file left.
   *
   * This script only upserts, so a text renamed, re-levelled or deleted in
   * `content/` keeps its database row - and a row is what the app actually
   * serves, so the old text goes on being offered to learners with nothing
   * anywhere saying it should not be. `build-seed-texts.ts` now removes the
   * stale files; this is the same blind spot one layer down.
   *
   * Reported, never deleted. `user_texts.text_id` is a foreign key to this
   * table, so a text somebody has read cannot be removed without taking their
   * reading history with it - which is exactly the rule CLAUDE.md states for
   * lexicon entries, for the same reason.
   */
  const { data: existing } = await db.from("texts").select("id").eq("source", "seed");
  const built = new Set(textRows.map((r) => r.id));
  const orphaned = ((existing ?? []) as { id: string }[]).filter((r) => !built.has(r.id));
  if (orphaned.length > 0) {
    console.warn(
      `\n⚠ ${orphaned.length} seed text(s) in the database have no file in content/:`,
    );
    for (const o of orphaned.slice(0, 20)) console.warn(`    ${o.id}`);
    console.warn(
      "  These are still served to learners. They are not deleted here because\n" +
        "  user_texts references them; removing one drops somebody's reading history.",
    );
  }
}
