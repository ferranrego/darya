/**
 * Repair entries whose gloss was never written.
 *
 * 290 Catalan entries carry the literal gloss `[C2 auto-fill]`, the headword
 * echoed back as its own example, and `pos: "noun"` regardless of what they
 * actually are. They are schema-valid and say nothing, and 225 of them sit
 * inside the B2 envelope.
 *
 * Two kinds of repair, because they are two different problems:
 *
 *   - A real word gets a gloss, a part of speech and an example, authored in
 *     scripts/data/ca-gloss-repairs.json and checked here by `verifyEntry` -
 *     the same harness the entry generator uses, so a repair cannot introduce
 *     anything an audit would later reject.
 *   - An artifact gets `"drop"` and a reason. Most are inflected forms the
 *     morphology engine already generates from a headword that is present
 *     (`segona`, `quals`, `pública`), and the rest are capitalised fragments
 *     that were never words (`Tal`, `obstant`). These keep their id and their
 *     row: `user_words.lexeme_id` has a foreign key to them and a learner may
 *     already have one in their deck, so deleting would orphan real progress.
 *     They are marked instead, which keeps them resolvable while making them
 *     permanently unteachable.
 *
 * Usage: node scripts/apply-ca-glosses.ts [--apply]
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema } from "../src/lib/content/schema.ts";
import { matchKey, normalizeCatalan } from "../src/lib/lang/ca/normalize.ts";
import { verifyEntry } from "./verify-ca-entries.ts";

interface Repair {
  /**
   * Replace the headword itself.
   *
   * 56 entries were ruled out as "an inflected form of X, which the engine
   * generates" where X was not in the lexicon at all - so the word was not made
   * redundant, it was deleted. The repair is to make the entry *be* the lemma:
   * `tracta` becomes `tractar`, `estudis` becomes `estudi`. That keeps the id,
   * so `user_words.lexeme_id` and the lexemeIds stored inside cached texts
   * still point at a real word, and the inflected form the entry used to hold
   * is then generated from the lemma as it always should have been.
   */
  target?: string;
  pos?: string;
  glossEn?: string;
  exampleTarget?: string;
  exampleEn?: string;
  /**
   * Register was never decided for these entries either: "formal" was stamped
   * across the whole bulk pass, exactly as `pos: noun` was, so `lloc`, `premi`
   * and `truita` were all marked formal. Authoring it is part of the repair.
   */
  register?: string;
  drop?: string;
}

const root = join(import.meta.dirname, "..", "content", "ca");
const path = join(root, "lexicon", "lexicon.json");
const file = JSON.parse(readFileSync(path, "utf8"));
lexiconFileSchema.parse(file);

const repairs: Record<string, Repair> = JSON.parse(
  readFileSync(join(import.meta.dirname, "data", "ca-gloss-repairs.json"), "utf8"),
);

/**
 * Marks an entry as deliberately not teachable.
 *
 * `teachability.ts` already refuses anything whose gloss is bracketed, so the
 * reason is written in that shape: it documents the decision in the data and
 * keeps the entry excluded, in one field, without a schema change.
 */
const dropGloss = (reason: string) => `[not a headword: ${reason}]`;

const apply = process.argv.includes("--apply");
const problems: string[] = [];
const seenKeys = new Map<string, string>();
for (const e of file.entries) {
  if (!repairs[e.id]) seenKeys.set(matchKey(e.targetNormalized ?? e.target), e.id);
}

let repaired = 0;
let dropped = 0;

for (const e of file.entries) {
  const r = repairs[e.id];
  if (!r || e.id.startsWith("_")) continue;

  if (r.drop) {
    e.glossEn = dropGloss(r.drop);
    e.exampleEn = e.glossEn;
    dropped++;
    continue;
  }

  const target = r.target ?? e.target;
  const next = {
    target,
    pos: r.pos ?? e.pos,
    register: r.register ?? e.register,
    glossEn: r.glossEn ?? e.glossEn,
    exampleTarget: r.exampleTarget ?? e.exampleTarget,
    exampleEn: r.exampleEn ?? e.exampleEn,
    targetNormalized: normalizeCatalan(target),
  };

  // The same gate the generator uses: charset, obsolete spellings, verb
  // paradigm size, apostrophation, the example containing the headword in a
  // form the engine produces, and sentence length. It takes the authoring
  // shape, which names the fields differently from the shipped one.
  const found = verifyEntry(
    {
      word: target,
      pos: next.pos,
      gloss: next.glossEn,
      example: next.exampleTarget,
      exampleEn: next.exampleEn,
    },
    seenKeys,
  );
  if (found.length) {
    problems.push(`${e.id} ${target}: ${found.join("; ")}`);
    continue;
  }

  Object.assign(e, next);
  repaired++;
}

console.log(`${repaired} repaired, ${dropped} marked as not headwords`);
if (problems.length) {
  console.error(`\n${problems.length} rejected by verifyEntry:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

if (!apply) {
  console.log("(dry run - pass --apply to rewrite the lexicon)");
} else {
  lexiconFileSchema.parse(file);
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
  console.log(`rewrote ${path}`);

  // Print the change in the terms it is about. "142 repaired" is not
  // checkable; "noun 290 -> 63, verb 0 -> 43" is, and it is the view in which
  // one wrong label stands out.
  const { execFileSync } = await import("node:child_process");
  execFileSync(
    process.execPath,
    [join(import.meta.dirname, "lexicon-diff.ts"), "--lang", "ca"],
    { stdio: "inherit" },
  );

}
