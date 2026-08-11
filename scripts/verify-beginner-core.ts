/**
 * Does the lexicon actually let a beginner say things?
 *
 * The first beginner list was written from memory, and measuring it showed what
 * that costs: every Catalan subject pronoun, every possessive, every
 * demonstrative, ten of twelve position words and fifteen numbers were present
 * in the lexicon and unreachable at the level that needs them. A learner could
 * not say `jo`, `aquest`, `sota`, `dreta` or `tres` in their first week - not
 * because the words were missing, but because nobody had thought of them.
 *
 * A list cannot catch that. A specification can, because it states what
 * coverage *means* and can therefore be falsified. Three kinds of requirement,
 * because the three kinds of vocabulary behave differently:
 *
 *   - Closed classes are finite, so completeness is checkable and any absence
 *     is a failure. There is no judgement in "a beginner needs `tu`".
 *   - Semantic fields are open, so they declare a minimum instead.
 *   - Verbs are specified by what they let a learner *do*. That is what catches
 *     `pagar`, `esperar` and `ajudar` - words no frequency list puts near the
 *     top and every beginner needs in week one.
 *   - Adjectives are grouped by the DIMENSION they describe. This started as a
 *     list of antonym pairs and that list was missing `gras/prim` and `roig`,
 *     for the same reason the original word list was missing pronouns: a list
 *     written from memory has holes shaped like whatever you forgot. The set of
 *     dimensions a beginner describes the world along - size, build, age,
 *     temperature, price, taste, colour - is small and nearly closed, so it can
 *     be enumerated deliberately and audited by someone else. Contrastive
 *     dimensions still need every pole: `gran` without `petit` is half a lesson.
 *
 * A word that resolves but is not teachable (a placeholder gloss) counts as
 * missing, which is the honest answer: the learner cannot be taught it.
 *
 * Usage: node scripts/verify-beginner-core.ts --lang ca [--json]
 */

import { existsSync, readFileSync, realpathSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema, type LexiconEntry } from "../src/lib/content/schema.ts";
import { isTeachable } from "../src/lib/content/teachability.ts";
import { buildLexiconIndex as buildCa } from "../src/lib/lang/ca/lexicon-index.ts";
import { matchKey as matchKeyCa } from "../src/lib/lang/ca/normalize.ts";
import { buildLexiconIndex as buildPrs } from "../src/lib/lang/prs/lexicon-index.ts";
import { matchKey as matchKeyPrs } from "../src/lib/lang/prs/normalize.ts";
import { contentRoot, targetLang } from "./content-path.ts";

export interface BeginnerSpec {
  closedClasses: Record<string, string[]>;
  semanticFields: Record<string, { min: number; seed: string[]; tag?: string }>;
  verbFunctions: Record<string, string[]>;
  descriptiveDimensions: Record<string, string[]>;
}

export function readSpec(root: string): BeginnerSpec | null {
  const path = join(root, "lexicon", "beginner-spec.json");
  if (!existsSync(path)) return null;
  const raw = JSON.parse(readFileSync(path, "utf8"));
  // `_comment` keys document the file for whoever opens it next; strip them so
  // they are never mistaken for a requirement.
  const strip = <T>(o: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith("_")));
  return {
    closedClasses: strip(raw.closedClasses ?? {}),
    semanticFields: strip(raw.semanticFields ?? {}),
    verbFunctions: strip(raw.verbFunctions ?? {}),
    descriptiveDimensions: strip(raw.descriptiveDimensions ?? {}),
  };
}

/** Every word the spec asks for, in one flat list. */
export function specWords(spec: BeginnerSpec): string[] {
  return [
    ...Object.values(spec.closedClasses).flat(),
    ...Object.values(spec.semanticFields).flatMap((f) => f.seed),
    ...Object.values(spec.verbFunctions).flat(),
    ...Object.values(spec.descriptiveDimensions).flat(),
  ];
}

function main() {
  const lang = targetLang();
  const root = contentRoot();
  const spec = readSpec(root);
  if (!spec) {
    console.error(`No beginner-spec.json for "${lang}".`);
    process.exit(1);
  }

  const entries: LexiconEntry[] = lexiconFileSchema.parse(
    JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
  ).entries;
  const index = lang === "ca" ? buildCa(entries) : buildPrs(entries);
  const matchKey = lang === "ca" ? matchKeyCa : matchKeyPrs;

  /**
   * Present, teachable, *and* the same word: the resolver's morphological
   * fallback can land on an unrelated lexeme (`sec` "dry" -> `seure` "to
   * sit"), which is exactly the `registre`/`registrar` class CLAUDE.md
   * documents, one level removed. A lemma-identical hit is required.
   */
  const direct = (word: string): LexiconEntry | null => {
    const e = index.resolve(word);
    if (!e || !isTeachable(e)) return null;
    const wantedKey = matchKey(word);
    const isMatch =
      matchKey(e.target) === wantedKey || e.variants.some((v) => matchKey(v) === wantedKey);
    return isMatch ? e : null;
  };

  /**
   * Dari's verbs are overwhelmingly compound (`فعل مرکب`): `بازی کردن`,
   * `جواب دادن`, `گپ زدن`. The construction is productive, so a learner who has
   * `بازی` and `کردن` can say `بازی می‌کند` - counting the compound as missing
   * would demand ~30 entries that duplicate parts already present.
   *
   * The same reasoning is what produced 68 false "the engine generates it"
   * claims once before, so this is deliberately narrow: it only fires when
   * *every* component resolves on its own and is teachable, and the result is
   * reported separately rather than folded into the pass count.
   */
  const compositional = new Set<string>();
  const usable = (word: string): LexiconEntry | null => {
    const hit = direct(word);
    if (hit) return hit;
    const parts = word.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return null;
    const resolved = parts.map(direct);
    if (resolved.some((p) => !p)) return null;
    compositional.add(word);
    return resolved.at(-1)!;
  };

  const gaps: { where: string; missing: string[] }[] = [];
  let required = 0;
  let met = 0;

  // --- closed classes: completeness -----------------------------------------
  for (const [name, words] of Object.entries(spec.closedClasses)) {
    const missing = words.filter((w) => !usable(w));
    required += words.length;
    met += words.length - missing.length;
    if (missing.length) gaps.push({ where: `closed class: ${name}`, missing });
  }

  // --- verb functions: every group must be covered ---------------------------
  for (const [fn, words] of Object.entries(spec.verbFunctions)) {
    const missing = words.filter((w) => !usable(w));
    required += words.length;
    met += words.length - missing.length;
    if (missing.length) gaps.push({ where: `verbs for ${fn}`, missing });
  }

  // --- descriptive dimensions: every pole of every dimension ------------------
  // A dimension with a hole in it is the failure this replaced a pair list to
  // catch: `alt` reachable and `gras` not is a learner who can describe a
  // building and not a person.
  for (const [dim, words] of Object.entries(spec.descriptiveDimensions)) {
    const missing = words.filter((w) => !usable(w));
    required += words.length;
    met += words.length - missing.length;
    if (missing.length) gaps.push({ where: `describing ${dim}`, missing });
  }

  // --- semantic fields: seeds present, and the field big enough ---------------
  const thin: string[] = [];
  const allTags = new Set(entries.flatMap((e) => e.tags));
  for (const [field, { min, seed, tag }] of Object.entries(spec.semanticFields)) {
    const missing = seed.filter((w) => !usable(w));
    required += seed.length;
    met += seed.length - missing.length;
    if (missing.length) gaps.push({ where: `field ${field}`, missing });

    // Beyond the named seeds, the field has to have some breadth - but only
    // where a real lexicon tag exists to measure it against. `field` names a
    // spec category, `tag` (when different) is the actual tag content was
    // themed with; for `Body & Health` those differ (`Body & Anatomy`).
    //
    // Checking `entries.tags.includes(field)` directly made this a dead check
    // for 7 of 17 fields, in both languages: min was set equal to seed.length
    // everywhere, so it could never fail, and the field-name mismatch meant
    // `inField` was silently 0 regardless. Rather than invent a tag for fields
    // no tagging pass has ever touched (Objects & Tools, Nature & Environment,
    // Leisure & Culture), those fall back to seed-only verification, which is
    // the honest state: nothing broader has been asserted about them yet.
    const lookupTag = tag ?? field;
    if (allTags.has(lookupTag)) {
      const inField = entries.filter((e) => e.tags.includes(lookupTag) && isTeachable(e)).length;
      const covered = Math.max(inField, seed.length - missing.length);
      if (covered < min) thin.push(`${field}: ${covered} of ${min}`);
    }
  }
  if (thin.length) gaps.push({ where: "fields below their minimum", missing: thin });

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify({ lang, required, met, gaps }, null, 2));
    process.exit(gaps.length ? 1 : 0);
  }

  console.log(`${lang}: ${met} of ${required} required words are present and teachable`);
  if (compositional.size) {
    console.log(
      `  (${compositional.size} met compositionally, every part present: ` +
        `${[...compositional].slice(0, 6).join(", ")}${compositional.size > 6 ? "…" : ""})`,
    );
  }
  console.log();
  for (const g of gaps) {
    console.log(`  ${g.where}`);
    console.log(`    ${g.missing.join("  ")}`);
  }
  if (!gaps.length) {
    console.log("No gaps. A beginner can be taught everything the spec asks for.");
    return;
  }
  const total = gaps.reduce((n, g) => n + g.missing.length, 0);
  console.error(`\n${total} gap(s) across ${gaps.length} requirement(s).`);
  process.exit(1);
}

// Only when run directly. `tag-beginner-core.ts` imports `readSpec`/`specWords`
// from here so the tag is derived from the same file the checker reads, and an
// unguarded `main()` would exit that process before it did anything.
if (process.argv[1] && import.meta.filename === realpathSync(process.argv[1])) main();
