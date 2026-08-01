/**
 * Check that a ruled-out entry is really redundant.
 *
 * 83 Catalan entries were marked "not a headword" with a reason of the form
 * *"Plural of 'X', which the morphology engine generates"*. That claim was
 * never tested, and it was wrong 82% of the time: 48 of them named a lemma
 * that is **not in the lexicon at all**, so the word was not made redundant,
 * it was deleted. `tal` (rank 197), `tractar` (315), `exemple` (322),
 * `central` (368), `realment` (448), `estudi` (637) and `existir` (732) all
 * vanished from the app that way. Another 15 named a lemma that is present but
 * does not generate the form, usually because `nominalForms` only emits
 * feminines for `pos: "adjective"` and the lemma is tagged `noun`.
 *
 * The lesson is narrower than "check your work": *"the engine generates it"* is
 * a statement about a running program, so it can be executed. An assertion that
 * can be executed and is not is just a claim.
 *
 * Usage: node scripts/verify-ca-drops.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema, type LexiconEntry } from "../src/lib/content/schema.ts";
import { isRuledOut } from "../src/lib/content/teachability.ts";
import { conjugationSurfaces } from "../src/lib/lang/ca/conjugate.ts";
import { nominalForms, verbSpec } from "../src/lib/lang/ca/lexicon-index.ts";
import { matchKey, normalizeCatalan } from "../src/lib/lang/ca/normalize.ts";

const root = join(import.meta.dirname, "..", "content", "ca");
const entries = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
).entries;

const byKey = new Map<string, LexiconEntry>();
for (const e of entries) byKey.set(matchKey(e.targetNormalized), e);

/** Every surface an entry generates, as it is actually tagged. */
function generatedBy(e: LexiconEntry): Set<string> {
  try {
    if (e.pos === "verb") {
      const spec = verbSpec(normalizeCatalan(e.target));
      return new Set((spec ? conjugationSurfaces(spec) : []).map(matchKey));
    }
    return new Set(nominalForms(e.target, e.pos).map(matchKey));
  } catch {
    return new Set();
  }
}

/** The lemma a drop reason points at, e.g. Plural of 'activitat'. */
function citedLemma(gloss: string): string | null {
  const m = gloss.match(/'([^']+)'/);
  return m ? m[1] : null;
}

const problems: string[] = [];
let checked = 0;
let sound = 0;

for (const e of entries) {
  if (!isRuledOut(e)) continue;
  checked++;
  const reason = e.glossEn;
  const lemma = citedLemma(reason);

  // A reason that names no lemma is a judgement ("capitalised fragment"), not a
  // redundancy claim, so there is nothing to execute. It still must not hide a
  // word the lexicon lacks entirely.
  if (!lemma) {
    // A judgement drop is covered if some *other* entry accounts for the word:
    // the multi-word phrase it is a fragment of (`obstant` inside
    // `no obstant això`), or the correctly spelled form it is a typo of
    // (`mati` for `matí`, which matchKey keeps distinct because Catalan
    // accents are meaningful and are deliberately not folded).
    const stripped = (w: string) => matchKey(w).normalize("NFD").replace(/\p{M}/gu, "");
    const covered = entries.some(
      (o) =>
        o.id !== e.id &&
        !isRuledOut(o) &&
        (stripped(o.target) === stripped(e.target) ||
          o.target.split(/[\s']+/).some((part) => matchKey(part) === matchKey(e.target))),
    );
    if (!covered) {
      problems.push(
        `${e.id} ${e.target} (rank ${e.freqRank}): ruled out as "${reason.slice(0, 60)}…" ` +
          `but no other entry covers it - the word is simply gone`,
      );
    } else sound++;
    continue;
  }

  const source = byKey.get(matchKey(lemma));
  if (!source) {
    problems.push(
      `${e.id} ${e.target} (rank ${e.freqRank}): cites '${lemma}', which is not in the lexicon`,
    );
    continue;
  }
  if (!generatedBy(source).has(matchKey(e.target))) {
    problems.push(
      `${e.id} ${e.target} (rank ${e.freqRank}): '${lemma}' [${source.pos}] does not generate it`,
    );
    continue;
  }
  sound++;
}

console.log(`${checked} ruled-out entries checked, ${sound} sound, ${problems.length} unsupported`);
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}
