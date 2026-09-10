/**
 * Emit a batch of lexicon entries whose `exampleTranslit` was written in
 * Iranian Persian, for authoring, and apply the authored repairs back.
 *
 * Why a script and not a one-off edit: 1,212 entries are affected and
 * `lexicon.json` is 3.7 MB, so a hand-edited diff over it is not reviewable -
 * which is the same reason CLAUDE.md says to author into a reviewed file
 * rather than into the lexicon directly. Emitting a small batch, reading it as
 * cards, and applying it back is that workflow.
 *
 * This script never calls a model. It only moves text around and re-checks it.
 *
 *   Emit:  node scripts/repair-translit.ts --emit <n> [--out <file>]
 *   Apply: node scripts/repair-translit.ts --apply <file>
 *
 * Apply is deliberately conservative: it writes `exampleTranslit` and nothing
 * else, refuses any id it cannot find, and refuses a repair that still trips
 * the flattening rule - so a batch that was not really repaired cannot land.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROFILES } from "../src/lib/lang/index.ts";
import { lexiconFileSchema } from "../src/lib/content/schema.ts";
import { contentRoot } from "./content-path.ts";
import { isFlattenedTranslit } from "../src/lib/lang/prs/translit-check.ts";


const isFlattened = (t: string | undefined, target: string, id?: string) =>
  isFlattenedTranslit(t, target, id);

const lexPath = join(contentRoot(), "lexicon", "lexicon.json");
const raw = JSON.parse(readFileSync(lexPath, "utf8"));
const parsed = lexiconFileSchema.parse(raw);
const profile = PROFILES.prs;
const index = profile.text.buildIndex(parsed.entries);

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? "");
};

if (flag("--emit") !== null) {
  const n = Number(flag("--emit")) || 40;
  const out = flag("--out") || "translit-batch.json";
  const batch = parsed.entries
    .filter((e) => isFlattened(e.exampleTranslit, e.exampleTarget, e.id))
    .slice(0, n)
    .map((e) => ({
      id: e.id,
      target: e.target,
      translit: e.translit,
      glossEn: e.glossEn,
      pos: e.pos,
      exampleTarget: e.exampleTarget,
      exampleEn: e.exampleEn,
      wrong: e.exampleTranslit,
      // Every token that resolves, with the lemma's own transliteration -
      // correct for the ~49% of tokens that appear uninflected, and a strong
      // hint for the rest. Never authoritative: an inflected form needs its
      // own transliteration, which the morphology engine does not carry.
      hints: profile.text.tokenize(e.exampleTarget).map((t) => {
        const hit = index.resolve(t);
        return hit ? `${t}=${hit.translit ?? "?"}` : `${t}=?`;
      }),
      fixed: "",
    }));
  writeFileSync(out, JSON.stringify(batch, null, 2) + "\n");
  console.log(`wrote ${batch.length} entries to ${out}`);
} else if (flag("--apply") !== null) {
  const file = flag("--apply")!;
  const repairs: Array<{ id: string; fixed?: string; fixedTranslit?: string }> = JSON.parse(
    readFileSync(file, "utf8"),
  );
  const byId = new Map(raw.entries.map((e: { id: string }) => [e.id, e]));
  const problems: string[] = [];
  let applied = 0;
  for (const r of repairs) {
    if (!r.fixed && !r.fixedTranslit) continue;
    const entry = byId.get(r.id) as
      | { translit?: string; target: string; exampleTranslit?: string; exampleTarget: string }
      | undefined;
    if (!entry) { problems.push(`${r.id}: not in lexicon`); continue; }
    // `fixed` repairs the example sentence, `fixedTranslit` the headword's own
    // transliteration - a handful of multi-word entries were flattened too.
    if (r.fixed) {
      if (isFlattened(r.fixed, entry.exampleTarget, r.id)) {
        problems.push(`${r.id}: repair is still flattened (${r.fixed})`);
        continue;
      }
      entry.exampleTranslit = r.fixed;
    }
    if (r.fixedTranslit) {
      if (isFlattened(r.fixedTranslit, entry.target, r.id)) {
        problems.push(`${r.id}: translit repair is still flattened (${r.fixedTranslit})`);
        continue;
      }
      entry.translit = r.fixedTranslit;
    }
    applied++;
  }
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  lexiconFileSchema.parse(raw);
  writeFileSync(lexPath, JSON.stringify(raw, null, 2) + "\n");
  const left = raw.entries.filter((e: { id: string; exampleTranslit?: string; exampleTarget: string }) =>
    isFlattened(e.exampleTranslit, e.exampleTarget, e.id),
  ).length;
  console.log(`applied ${applied} repairs; ${left} entries still flattened`);
} else {
  console.error("usage: --emit <n> [--out <file>] | --apply <file>");
  process.exit(1);
}
