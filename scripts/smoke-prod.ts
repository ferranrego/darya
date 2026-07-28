/**
 * End-to-end smoke check of real production data against the real code paths.
 *
 * `validate:db` checks the *shared* caches. This checks the *per-user* rows,
 * which is where today's outage actually surfaced: the reader worked for one
 * account and threw for another, because only one of them had a generated text
 * in its history.
 *
 * For every user it replays what the app does on load, using the same functions
 * the app uses, and reports anything that would throw or render blank. No
 * writes, no auth - service role reads only.
 *
 * Run: pnpm smoke
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lexiconFileSchema, textDocumentSchema } from "../src/lib/content/schema.ts";
import { reviveCard, previewIntervals, isGraduated } from "../src/lib/srs/scheduler.ts";
import { buildIndex, tokenize } from "../src/lib/text/index.ts";
import { contentRoot, targetLang } from "./content-path.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
const db = createClient(url, secret, { auth: { persistSession: false } });

const lexicon = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(contentRoot(), "lexicon", "lexicon.json"), "utf8")),
);
const index = buildIndex(lexicon.entries);
const byId = index.byId;

let problems = 0;
const fail = (msg: string) => {
  problems++;
  console.error(`  ✗ ${msg}`);
};

console.log(`smoke: language=${targetLang()}, lexicon=${lexicon.entries.length} entries\n`);

const { data: profiles } = await db.from("profiles").select("id, display_name, level_estimate");
console.log(`users: ${profiles?.length ?? 0}`);

for (const user of profiles ?? []) {
  const who = `${user.display_name ?? "?"} (${user.id.slice(0, 8)})`;
  console.log(`\n── ${who}`);

  // 1. SRS deck: every user_word must resolve to a lexeme, and its FSRS card
  //    must revive. A missing lexeme used to strand the review queue forever.
  const { data: words } = await db.from("user_words").select("*").eq("user_id", user.id);
  let missingLexeme = 0;
  let badCard = 0;
  let due = 0;
  for (const w of words ?? []) {
    if (!byId.get(w.lexeme_id)) {
      missingLexeme++;
      fail(`user_words -> unknown lexeme ${w.lexeme_id}`);
    }
    if (w.fsrs) {
      try {
        const card = reviveCard(w.fsrs);
        previewIntervals(card, new Date());
        isGraduated(card);
        if (w.due && new Date(w.due) <= new Date()) due++;
      } catch (e) {
        badCard++;
        fail(`user_words ${w.lexeme_id} -> FSRS card unusable: ${(e as Error).message}`);
      }
    }
  }
  console.log(
    `   deck: ${words?.length ?? 0} words, ${due} due` +
      (missingLexeme || badCard ? "" : "  ✓ all resolve, all cards revive"),
  );

  // 2. Reading history: every text must parse, and the reader's own layout
  //    computation must not throw. This is the exact line that broke today.
  const { data: hist } = await db
    .from("user_texts")
    .select("text_id, texts(*)")
    .eq("user_id", user.id);
  let unreadable = 0;
  let totalTokens = 0;
  let unresolvedTokens = 0;
  for (const row of hist ?? []) {
    const raw = (row as unknown as { texts: { doc: unknown } | null }).texts;
    if (!raw) {
      fail(`user_texts -> missing text ${row.text_id}`);
      unreadable++;
      continue;
    }
    const parsed = textDocumentSchema.safeParse(raw.doc);
    if (!parsed.success) {
      fail(`text ${row.text_id} does not match schema: ${parsed.error.issues[0]?.message}`);
      unreadable++;
      continue;
    }
    try {
      // text-reader.tsx:175 - threw on pre-rename docs.
      Math.max(...parsed.data.sentences.map((s) => s.target.length));
      for (const s of parsed.data.sentences) {
        for (const t of tokenize(s.target)) {
          totalTokens++;
          if (!index.resolve(t)) unresolvedTokens++;
        }
      }
    } catch (e) {
      fail(`text ${row.text_id} render computation threw: ${(e as Error).message}`);
      unreadable++;
    }
  }
  const pct = totalTokens ? ((100 * unresolvedTokens) / totalTokens).toFixed(1) : "0.0";
  console.log(
    `   history: ${hist?.length ?? 0} texts, ${unreadable} unreadable, ` +
      `${unresolvedTokens}/${totalTokens} tokens unresolved (${pct}%)`,
  );
}

// 3. Anything a user could be served next.
const { data: exercises } = await db.from("exercises").select("id, type");
const { data: texts } = await db.from("texts").select("id");
console.log(`\nservable: ${texts?.length ?? 0} texts, ${exercises?.length ?? 0} exercises`);

if (problems) {
  console.error(`\n${problems} problem(s) found in production data.`);
  process.exit(1);
}
console.log("\nNo problems. Every user's deck and reading history is intact.");
