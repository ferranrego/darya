/**
 * Whether the app is actually teaching anybody, in numbers.
 *
 * Read-only, human-run, no model call. Everything here was uncollectable
 * before this refactor: `review_logs.rating` was written and read by nothing,
 * comprehension was not checked at all, `user_exercises` could not record a
 * second attempt, and the gap between recognising a word and producing one did
 * not exist as a fact anywhere.
 *
 *   pnpm report:learning
 *
 * Aggregates only. This prints counts and rates across the deployment, never a
 * learner's own words, sentences or mistakes - the point is to find out whether
 * the method works, which needs no personal data, and the chat purge exists for
 * a reason.
 *
 * Requires SUPABASE_SECRET_KEY: it reads across all rows, which RLS correctly
 * forbids to any normal client.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
}
const db: SupabaseClient = createClient(url, secret, { auth: { persistSession: false } });

function pct(n: number, of: number): string {
  return of === 0 ? "n/a" : `${Math.round((n / of) * 100)}%`;
}

function heading(text: string): void {
  console.log(`\n${text}\n${"-".repeat(text.length)}`);
}

/** Page through a table; PostgREST caps a single response at 1,000 rows. */
async function all<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

heading("Learners");
const profiles = await all<{ id: string; level_estimate: string; onboarded_at: string | null }>(
  "profiles",
  "id,level_estimate,onboarded_at",
);
console.log(`${profiles.length} profiles, ${profiles.filter((p) => p.onboarded_at).length} onboarded`);
{
  const byLevel = new Map<string, number>();
  for (const p of profiles) byLevel.set(p.level_estimate, (byLevel.get(p.level_estimate) ?? 0) + 1);
  for (const [level, n] of [...byLevel].sort()) console.log(`  ${level}: ${n}`);
}

heading("Retention");
{
  // Broken out by FSRS card state, because the aggregate is not a real
  // quantity: state 0 is a card being seen for the first time and state 1 is
  // one still on its opening steps, both failed often by design. Only states 2
  // and 3 answer "did it survive the interval", and only those feed the
  // promotion floor - printed here so the two cannot drift apart unnoticed.
  const logs = await all<{ rating: number; log: { state?: number } | null }>(
    "review_logs",
    "rating,log",
  );
  const NAMES = ["new", "learning", "review", "relearning"];
  for (let state = 0; state < NAMES.length; state++) {
    const at = logs.filter((l) => (l.log?.state ?? 0) === state);
    if (at.length === 0) continue;
    const ok = at.filter((l) => l.rating > 1).length;
    console.log(`  ${NAMES[state]}: ${at.length} reviews, ${pct(ok, at.length)} remembered`);
  }
  const mature = logs.filter((l) => (l.log?.state ?? 0) >= 2);
  const matureOk = mature.filter((l) => l.rating > 1).length;
  console.log(
    `retention (mature cards, what promotion reads): ${matureOk} of ${mature.length} ` +
      `(${pct(matureOk, mature.length)})`,
  );
  if (logs.length === 0) console.log("  (no reviews yet - nothing to say)");
}

heading("Recognising versus producing");
{
  // The gap this refactor exists to expose. Before it, "known" meant
  // accumulated self-report with the answer already on screen.
  const words = await all<{ status: string; produced_count: number | null }>(
    "user_words",
    "status,produced_count",
  );
  const known = words.filter((w) => w.status === "known");
  const producedKnown = known.filter((w) => (w.produced_count ?? 0) > 0).length;
  const producedAny = words.filter((w) => (w.produced_count ?? 0) > 0).length;
  console.log(`${words.length} tracked words, ${known.length} at "known"`);
  console.log(`${producedAny} have been written correctly at least once (${pct(producedAny, words.length)})`);
  console.log(
    `${producedKnown} of the "known" ones have (${pct(producedKnown, known.length)}) - ` +
      `the rest graduated on self-report before this was required`,
  );
}

heading("Comprehension");
{
  const texts = await all<{
    comprehension_correct: number | null;
    comprehension_total: number | null;
  }>("user_texts", "comprehension_correct,comprehension_total");
  const taken = texts.filter((t) => t.comprehension_total !== null);
  let correct = 0;
  let asked = 0;
  for (const t of taken) {
    correct += t.comprehension_correct ?? 0;
    asked += t.comprehension_total ?? 0;
  }
  console.log(`${texts.length} texts read, ${taken.length} with a comprehension check (${pct(taken.length, texts.length)})`);
  console.log(`${correct} of ${asked} questions right (${pct(correct, asked)})`);
  if (asked > 0 && correct / asked < 0.3) {
    // Four options, so 25% is the floor of pure guessing.
    console.log("  ! at or below chance - the questions or the level are wrong, not the learners");
  }
}

heading("Exercises");
{
  const rows = await all<{ is_correct: boolean; attempt: number }>(
    "user_exercises",
    "is_correct,attempt",
  );
  const first = rows.filter((r) => (r.attempt ?? 1) === 1);
  const firstRight = first.filter((r) => r.is_correct).length;
  console.log(`${rows.length} exercise answers, ${first.length} first attempts`);
  console.log(`${firstRight} right first time (${pct(firstRight, first.length)})`);
}

heading("Practice that cost nothing");
{
  // Five free-tier provider quotas are shared by every learner of the
  // deployment, so this is the number that says how much headroom the change
  // bought back.
  const rows = await all<{ source: string }>("exercises", "source");
  const free = rows.filter((r) => r.source === "seed-text").length;
  console.log(`${rows.length} stored exercises, ${free} built from seed text (${pct(free, rows.length)})`);
}

heading("Mistakes");
{
  const rows = await all<{ kind: string; resolved_at: string | null }>(
    "learner_errors",
    "kind,resolved_at",
  );
  const resolved = rows.filter((r) => r.resolved_at).length;
  console.log(`${rows.length} recorded, ${resolved} since resolved (${pct(resolved, rows.length)})`);
  const byKind = new Map<string, number>();
  for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
  for (const [kind, n] of [...byKind].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${kind}: ${n}`);
  }
  if (rows.length === 0) {
    console.log("  (nothing recorded yet - this table is new)");
  }
}

console.log("");
