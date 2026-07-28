/**
 * Validate every cached jsonb blob in the database against the Zod schema the
 * runtime actually reads it with.
 *
 * Why this exists: `validate:content` covers `content/*.json`, and the type
 * checker covers code, but nothing covered the jsonb columns in between. Those
 * are written by the AI pipeline and *cast* rather than parsed on read, so a
 * schema change silently leaves stale blobs behind. The dari -> target rename
 * did exactly that: 32 cached texts kept `dari`/`titleDari`, and the reader
 * threw for any user whose history contained one - while a user with no
 * generated history saw nothing wrong.
 *
 * This is deliberately schema-driven rather than a list of old field names. Any
 * drift is caught - renames, newly-required fields, changed types - not just
 * the one that already bit us.
 *
 * Run: pnpm validate:db
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { z } from "zod";
import {
  exerciseItemSchema,
  rawItemSchema,
  sentenceExplanationSchema,
} from "../src/lib/ai/schemas.ts";
import { textDocumentSchema } from "../src/lib/content/schema.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
const db: SupabaseClient = createClient(url, secret, { auth: { persistSession: false } });

interface Check {
  table: string;
  column: string;
  /** Primary key column, for reporting which row is bad. */
  key: string;
  schema: z.ZodType;
  /** Blob holds an array of items, each validated individually. */
  eachItem?: boolean;
  /** A null/absent value is legitimate (optional cache). */
  nullable?: boolean;
}

const CHECKS: Check[] = [
  { table: "texts", column: "doc", key: "id", schema: textDocumentSchema },
  { table: "exercises", column: "data", key: "id", schema: exerciseItemSchema },
  {
    table: "sentence_explanations",
    column: "explanation",
    key: "sentence_hash",
    schema: sentenceExplanationSchema,
  },
  { table: "grammar_practice", column: "exercise", key: "id", schema: rawItemSchema },
];

let failed = 0;

for (const check of CHECKS) {
  const { data, error } = await db
    .from(check.table)
    .select(`${check.key}, ${check.column}`)
    .overrideTypes<Record<string, unknown>[]>();
  if (error) {
    console.error(`✗ ${check.table}.${check.column}: query failed - ${error.message}`);
    failed++;
    continue;
  }

  // The dynamic select() defeats supabase-js's typed row inference, so treat
  // rows as plain records - the schemas below are what actually validate them.
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const bad: string[] = [];

  for (const row of rows) {
    const value = row[check.column];
    if (value == null) {
      if (!check.nullable) bad.push(`${row[check.key]}: null`);
      continue;
    }
    const items = check.eachItem && Array.isArray(value) ? value : [value];
    for (const item of items) {
      const parsed = check.schema.safeParse(item);
      if (parsed.success) continue;
      bad.push(
        `${row[check.key]}: ` +
          parsed.error.issues
            .slice(0, 2)
            .map((i) => `${i.path.join(".") || "(root)"} ${i.message}`)
            .join("; "),
      );
      break;
    }
  }

  if (bad.length) {
    failed++;
    console.error(`✗ ${check.table}.${check.column}: ${bad.length}/${rows.length} invalid`);
    for (const line of bad.slice(0, 8)) console.error(`    ${line}`);
    if (bad.length > 8) console.error(`    … and ${bad.length - 8} more`);
  } else {
    console.log(`✓ ${check.table}.${check.column} (${rows.length} rows)`);
  }
}

// Reading history is the one cache users cannot regenerate, so call out anyone
// who would hit a blank reader.
{
  const { data: texts } = await db.from("texts").select("id, doc");
  const broken = new Set(
    (texts ?? []).filter((t) => !textDocumentSchema.safeParse(t.doc).success).map((t) => t.id),
  );
  const { data: ut } = await db.from("user_texts").select("user_id, text_id");
  const affected = new Set(
    (ut ?? []).filter((r) => broken.has(r.text_id)).map((r) => r.user_id),
  );
  if (affected.size) {
    console.error(`\n✗ ${affected.size} user(s) have an unreadable text in their history:`);
    for (const uid of affected) console.error(`    ${uid}`);
    failed++;
  }
}

if (failed) {
  console.error(
    `\n${failed} check(s) failed. Cached blobs have drifted from the schemas the app reads them with.`,
  );
  process.exit(1);
}
console.log("\nAll cached blobs match their schemas.");
