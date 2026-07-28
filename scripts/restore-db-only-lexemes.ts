/**
 * One-off: pull lexemes that exist only in the database back into content/.
 *
 * docs/ARCHITECTURE.md invariant #1: "Content is data, not code. […] the app
 * never depends on data that exists only in the DB." That had drifted - the
 * `lexemes` table held 6033 rows against 5997 in content/lexicon.json, so 36
 * real words (ولی "but", آیا the yes/no particle, مرا, هرگز…) were resolvable by
 * the seeded database but invisible to the app, which builds its index from the
 * bundled JSON.
 *
 * Two consequences, both observed:
 *   * a learner had 4 of them in her SRS deck; `lexemeById` returned undefined,
 *     so those cards could never be reviewed;
 *   * تشریف / جناب / موفق / سو are used by the C1-C2 grammar lessons, which is
 *     why `validate:content` reported them as "not in lexicon".
 *
 * Run: node --env-file=.env.local scripts/restore-db-only-lexemes.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { contentRoot } from "./content-path.ts";

const dryRun = process.argv.includes("--dry-run");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
const db = createClient(url, secret, { auth: { persistSession: false } });

const lexiconPath = join(contentRoot(), "lexicon", "lexicon.json");
const file = JSON.parse(readFileSync(lexiconPath, "utf8"));
const have = new Set<string>(file.entries.map((e: { id: string }) => e.id));

// PostgREST caps a select at 1000 rows; page explicitly or this silently lies.
const rows: Record<string, unknown>[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from("lexemes").select("*").range(from, from + 999);
  if (error) throw error;
  if (!data?.length) break;
  rows.push(...data);
  if (data.length < 1000) break;
}

const missing = rows
  .filter((r) => !have.has(r.id as string))
  .sort((a, b) => (a.freq_rank as number) - (b.freq_rank as number));

console.log(`lexemes in DB: ${rows.length}, in content/: ${have.size}, DB-only: ${missing.length}`);

/** DB row -> content entry. Drops nulls so optional fields stay absent. */
const toEntry = (r: Record<string, unknown>) => {
  const e: Record<string, unknown> = {
    id: r.id,
    target: r.target,
    targetNormalized: r.target_normalized ?? r.target,
    translit: r.translit,
    glossEn: r.gloss_en,
    pos: r.pos,
    freqRank: r.freq_rank,
    freqBand: r.freq_band,
    register: r.register ?? "neutral",
    variants: r.variants ?? [],
    exampleTarget: r.example_target,
    exampleTranslit: r.example_translit,
    exampleEn: r.example_en,
    tags: r.tags ?? [],
  };
  if (r.present_stem) e.presentStem = r.present_stem;
  if (r.audio_url) e.audioUrl = r.audio_url;
  for (const k of Object.keys(e)) if (e[k] === null || e[k] === undefined) delete e[k];
  return e;
};

for (const r of missing) {
  console.log(`  + ${r.id}  ${r.target}  = ${r.gloss_en}`);
  file.entries.push(toEntry(r));
}
file.entries.sort((a: { freqRank: number }, b: { freqRank: number }) => a.freqRank - b.freqRank);

if (dryRun) {
  console.log("\n[dry-run] no changes written");
} else {
  writeFileSync(lexiconPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nWrote ${lexiconPath} (${file.entries.length} entries)`);
}
