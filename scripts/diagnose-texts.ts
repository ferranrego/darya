/**
 * Integrity check for the cached `texts.doc` jsonb blobs.
 *
 * `texts.doc` is cast rather than zod-parsed by db/texts.ts, so a shape drift
 * there is invisible until the reader throws. That is exactly what happened
 * after the dari -> target rename: the SQL columns and content/ JSON moved, but
 * the 32 AI-generated docs already in the database kept `dari` / `titleDari`,
 * and text-reader.tsx:175 (`s.target.length`) threw for any user whose history
 * contained one.
 *
 * This validates every row against the real schema, so the same class of drift
 * is caught from the command line instead of from a user's blank screen.
 *
 * Run: pnpm diagnose:texts
 */
import { createClient } from "@supabase/supabase-js";
import { textDocumentSchema } from "../src/lib/content/schema.ts";
import { normalize } from "../src/lib/text/index.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
const db = createClient(url, secret, { auth: { persistSession: false } });

const { data: texts, error } = await db.from("texts").select("id, source, level, doc");
if (error) throw error;
const rows = texts ?? [];

let valid = 0;
const invalid: string[] = [];
let emptySentence = 0;
let tokenMismatch = 0;

for (const row of rows) {
  const parsed = textDocumentSchema.safeParse(row.doc);
  if (!parsed.success) {
    invalid.push(
      `${row.id} (${row.source}): ${parsed.error.issues
        .slice(0, 2)
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
    continue;
  }
  valid++;
  for (const s of parsed.data.sentences) {
    if (!s.target.trim()) emptySentence++;
    // Token surfaces are normalized (Arabic ي/ك folded to Persian ی/ک) but the
    // generation pipeline stores the sentence text raw, so a surface can be
    // absent from its own sentence. Compare normalized on both sides: a real
    // desynchronisation still shows up, a mere folding difference does not.
    if (!s.tokens.every((t) => normalize(s.target).includes(normalize(t.surface)))) {
      tokenMismatch++;
    }
  }
}

console.log(`texts rows: ${rows.length}`);
console.log(`  valid against textDocumentSchema: ${valid}`);
console.log(`  invalid: ${invalid.length}`);
for (const line of invalid.slice(0, 10)) console.log(`    ✗ ${line}`);
console.log(`  empty sentence targets: ${emptySentence}`);
console.log(`  sentences whose tokens do not all appear in the text: ${tokenMismatch}`);

const badIds = new Set(
  rows.filter((r) => !textDocumentSchema.safeParse(r.doc).success).map((r) => r.id),
);
const { data: ut } = await db.from("user_texts").select("user_id, text_id");
const affected = new Set((ut ?? []).filter((r) => badIds.has(r.text_id)).map((r) => r.user_id));
console.log(`\nusers with >=1 unreadable text in history: ${affected.size}`);
for (const uid of affected) console.log(`  ${uid}`);

if (invalid.length || emptySentence || tokenMismatch) process.exit(1);
