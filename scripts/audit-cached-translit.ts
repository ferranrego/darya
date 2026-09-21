/**
 * Audit the transliteration in the shared AI caches, the way the gate audits
 * `content/`.
 *
 * Those caches are the one place model-written Dari reaches learners without
 * passing through `pnpm gate`, and until `translitProblems` was wired into the
 * generator, nothing had ever looked at them. The first run found 26 of 53
 * cached context sentences breaking conventions their own prompt stated - the
 * repo's usual lesson, that a finding you only fix comes back, and a finding
 * that becomes a check does not.
 *
 * Read-only on purpose, and it stays that way. Deciding a cached row is wrong
 * is cheap; deleting it is somebody's call, and `audit-ca-lexicon.ts --fix` is
 * the standing reminder of what a repair flag does when nobody is watching.
 *
 *   node scripts/audit-cached-translit.ts
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY. Makes no model calls.
 */
import { createClient } from "@supabase/supabase-js";
import { translitProblems } from "../src/lib/lang/prs/translit-rules.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");
  process.exit(1);
}
const db = createClient(url, key);

/** Every translit string in a jsonb payload, paired with the target beside it. */
function pairs(node: unknown, acc: Array<[string, string | undefined]> = []): Array<[string, string | undefined]> {
  if (Array.isArray(node)) {
    for (const v of node) pairs(v, acc);
    return acc;
  }
  if (node && typeof node === "object") {
    const o = node as Record<string, unknown>;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && /ranslit$/i.test(k)) {
        const tk = Object.keys(o).find((c) => /arget$/i.test(c) && typeof o[c] === "string");
        acc.push([v, tk ? (o[tk] as string) : undefined]);
      } else {
        pairs(v, acc);
      }
    }
  }
  return acc;
}

let total = 0;
let bad = 0;
const byRule = new Map<string, number>();

function inspect(label: string, units: Array<[string, string | undefined]>) {
  let localBad = 0;
  for (const [translit, target] of units) {
    total++;
    const problems = translitProblems(translit, target);
    if (problems.length === 0) continue;
    bad++;
    localBad++;
    for (const p of problems) byRule.set(p.rule, (byRule.get(p.rule) ?? 0) + 1);
    if (localBad <= 3) console.log(`   ✗ ${problems.map((p) => p.message).join("; ")}\n     ${translit}`);
  }
  console.log(`${label}: ${localBad}/${units.length} transliterations break a convention`);
}

// Columns, not jsonb: the rotating flashcard sentences.
{
  const { data, error } = await db.from("lexeme_context_sentences").select("target, translit");
  if (error) console.log(`lexeme_context_sentences: unreadable (${error.message})`);
  else inspect("lexeme_context_sentences", (data ?? []).map((r) => [r.translit ?? "", r.target]));
}

// jsonb payloads.
for (const [table, col] of [
  ["sentence_explanations", "explanation"],
  ["texts", "doc"],
] as const) {
  const { data, error } = await db.from(table).select(col);
  if (error) {
    console.log(`${table}.${col}: unreadable (${error.message})`);
    continue;
  }
  const units = (data ?? []).flatMap((r) => pairs((r as Record<string, unknown>)[col]));
  inspect(`${table}.${col}`, units);
}

console.log(`\n${bad}/${total} transliterations break a convention`);
for (const [rule, n] of [...byRule].sort((a, b) => b[1] - a[1])) {
  console.log(`   ${String(n).padStart(5)}  ${rule}`);
}
if (bad > 0) {
  console.log("\nThese are caches. They regenerate, so the repair is to delete the rows -");
  console.log("deliberately, by hand, after looking at them.");
}
