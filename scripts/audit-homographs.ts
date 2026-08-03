/**
 * Find sentences where the reader teaches the wrong sense of a real homograph.
 *
 * Catalan generates a lot of its lexicon mechanically: `nominalForms` produces
 * every gender/number spelling of a noun or adjective, `conjugationSurfaces`
 * produces every conjugated form of a verb (see `src/lib/lang/ca/lexicon-index.ts`,
 * which now exports `generatedSurfacesOf`, and `src/lib/lang/prs/lexicon-index.ts`,
 * which exports `buildGeneratedForms`, for exactly this reason - so this script
 * enumerates the same forms production resolution generates, not a slightly
 * different reimplementation that could drift from it). Sometimes one of those
 * generated forms spells identically to a *different* entry's authored
 * headword: `neta` is both the noun "granddaughter" and the generated feminine
 * of the adjective `net` ("clean"). `resolve()`'s precedence always prefers an
 * authored headword over a generated form, with no sentence context, so the
 * noun wins regardless of what the sentence actually means.
 *
 * That would be a curiosity if it were checkable. It is not, by construction:
 * seed texts store a `lexemeId` *per token*, baked in at build time by
 * `scripts/build-seed-texts.ts` calling the same `resolve()`. `validate-content.ts`
 * then checks that the stored id agrees with `resolve(surface)` - and when
 * `resolve()` picks the wrong homograph, the stored id and `resolve()` agree on
 * the *same wrong answer*, so that check passes. Two real defects shipped
 * exactly this way: `cuina` (lx-0372, noun "kitchen") shadowed the verb
 * `cuinar`'s 3rd-person present in "La meva mare cuina molt bé" - a learner
 * tapping it was taught "kitchen", not "cooks" - and `compra` (lx-0853, noun
 * "purchase") did the same to `comprar` in "...sempre la compra algú que no
 * és d'aquí".
 *
 * Of 176 ambiguous surfaces the Catalan lexicon can generate, only 18 are
 * actually used anywhere in `content/ca/texts/seed`, and of those 18, 16
 * resolve to the correct sense already (`una`/`els`/`les`/`un` as articles,
 * `casa`, `diners`, `fins`, `amiga`, `ells`, `sou`, `deu`, `seu`, `correu`,
 * `estudiant`, `mica`, `sabates`) - the ambiguity exists but either the two
 * entries are near-duplicates (`una` vs `un`'s generated feminine) or the
 * sentence happens to want the headword sense anyway. Dari has the same shape
 * of risk in its generated verb paradigms and turned up 3 real usages
 * (`بازی`, `گذشته`, `خورد`), all likewise already correct. Those 19 across both
 * languages are recorded, with the human reason, in `content/<lang>/lexicon/
 * homograph-review.json` - the same "record the decision in data, verify it
 * mechanically" shape as `isRuledOut`/`verify-ca-drops.ts` uses for redundant
 * entries. This script fails only when a *reviewed* surface's stored binding
 * stops matching the recorded decision, or when content uses an ambiguous
 * surface with no reviewed decision at all - so a new text that introduces a
 * wrong homograph binding fails the gate, while the confirmed ones stay silent.
 *
 * Usage: node scripts/audit-homographs.ts [--lang ca|prs] [--list]
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { lexiconFileSchema, textDocumentSchema, type LexiconEntry } from "../src/lib/content/schema.ts";
import { isRuledOut } from "../src/lib/content/teachability.ts";
import { PROFILES } from "../src/lib/lang/index.ts";
import { generatedSurfacesOf } from "../src/lib/lang/ca/lexicon-index.ts";
import { buildGeneratedForms } from "../src/lib/lang/prs/lexicon-index.ts";
import { contentRoot, targetLang } from "./content-path.ts";

/** A generated surface that collides with a different entry's own headword. */
export interface Ambiguity {
  /** The colliding matchKey - shared lookup key across languages. */
  key: string;
  /** A real spelling that produces `key`, for display. */
  surface: string;
  generator: LexiconEntry;
  headword: LexiconEntry;
}

/**
 * A human decision that a specific ambiguous surface, as it is actually used,
 * resolves to the right sense - the same shape as `isRuledOut`'s "not a
 * headword" reasons: a claim recorded in data and checked mechanically, not a
 * comment trusted on faith.
 */
export interface ReviewedHomograph {
  surface: string;
  correctLexemeId: string;
  reason: string;
}

export interface HomographUsage {
  file: string;
  sentence: string;
  surface: string;
  storedLexemeId: string;
  ambiguity: Ambiguity;
  review: ReviewedHomograph | null;
  /** false when unreviewed, or reviewed but the stored id contradicts it. */
  ok: boolean;
}

export interface HomographAudit {
  ambiguities: Map<string, Ambiguity>;
  usages: HomographUsage[];
}

/**
 * Every surface `generatedSurfacesOf` would emit for some entry that collides
 * with a *different*, non-ruled-out entry's headword - i.e. every case where
 * `resolve()`'s headwords-beat-generated-forms precedence silently picks the
 * headword's sense over the generated form's, with no way to tell from the
 * surface alone.
 */
export function ambiguousSurfacesCa(entries: LexiconEntry[], matchKey: (s: string) => string): Map<string, Ambiguity> {
  const headwordByKey = new Map<string, LexiconEntry>();
  for (const e of entries) {
    const key = matchKey(e.targetNormalized);
    if (!headwordByKey.has(key)) headwordByKey.set(key, e);
  }

  // First-write-wins per key, mirroring buildLexiconIndex's `generated` map -
  // entries are frequency-ordered, so a contested key goes to the entry that
  // would actually win it in the real "generated" bucket.
  const generatedByKey = new Map<string, { entry: LexiconEntry; surface: string }>();
  for (const e of entries) {
    for (const surface of generatedSurfacesOf(e)) {
      const key = matchKey(surface);
      if (!generatedByKey.has(key)) generatedByKey.set(key, { entry: e, surface });
    }
  }

  const out = new Map<string, Ambiguity>();
  for (const [key, { entry: generator, surface }] of generatedByKey) {
    const headword = headwordByKey.get(key);
    if (!headword || headword.id === generator.id) continue;
    if (isRuledOut(headword)) continue; // a documented, verified redundancy - not a live ambiguity
    out.set(key, { key, surface, generator, headword });
  }
  return out;
}

/**
 * Same question for Dari: does a verb's generated conjugation collide with a
 * different entry's headword? Dari does not generate nominal (plural/possessive)
 * forms into a static map - those are resolved by stripping suffixes at lookup
 * time instead (see `resolve()`'s stemmer) - so verb paradigms are the only
 * generated-form source to check here.
 */
function ambiguousSurfacesPrs(entries: LexiconEntry[], matchKey: (s: string) => string): Map<string, Ambiguity> {
  const headwordByKey = new Map<string, LexiconEntry>();
  for (const e of entries) {
    const key = matchKey(e.targetNormalized);
    if (!headwordByKey.has(key)) headwordByKey.set(key, e);
  }

  const generated = buildGeneratedForms(entries, headwordByKey);

  const out = new Map<string, Ambiguity>();
  for (const [key, generator] of generated) {
    const headword = headwordByKey.get(key);
    if (!headword || headword.id === generator.id) continue;
    if (isRuledOut(headword)) continue;
    // buildGeneratedForms only returns the folded key, not the original
    // spelling (it is built for lookup, not display) - the key itself is
    // still legible Dari/Persian text (diacritics and alef variants folded),
    // so it doubles as the display surface here.
    out.set(key, { key, surface: key, generator, headword });
  }
  return out;
}

function loadReview(root: string): ReviewedHomograph[] {
  const file = join(root, "lexicon", "homograph-review.json");
  if (!existsSync(file)) return [];
  const parsed = JSON.parse(readFileSync(file, "utf8"));
  if (!Array.isArray(parsed.reviewed)) {
    throw new Error(`${file}: expected { "reviewed": [...] }`);
  }
  return parsed.reviewed as ReviewedHomograph[];
}

/**
 * The whole audit: enumerate ambiguous surfaces for `lang`, then cross-
 * reference against every seed text under `root`/texts/seed. Exported so
 * `validate-content.ts` can run the exact same check as part of
 * `pnpm validate:content`, rather than a parallel reimplementation.
 */
export function auditHomographs(
  lang: string,
  root: string,
  entries: LexiconEntry[],
  matchKey: (s: string) => string,
): HomographAudit {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const ambiguities =
    lang === "ca"
      ? ambiguousSurfacesCa(entries, matchKey)
      : lang === "prs"
        ? ambiguousSurfacesPrs(entries, matchKey)
        : new Map<string, Ambiguity>();

  const reviewByKey = new Map<string, ReviewedHomograph>();
  for (const r of loadReview(root)) {
    if (!byId.has(r.correctLexemeId)) {
      throw new Error(`homograph-review.json: "${r.surface}" cites unknown lexeme ${r.correctLexemeId}`);
    }
    reviewByKey.set(matchKey(r.surface), r);
  }

  const seedDir = join(root, "texts", "seed");
  const usages: HomographUsage[] = [];
  if (existsSync(seedDir)) {
    for (const f of readdirSync(seedDir).filter((n) => n.endsWith(".json"))) {
      const parsed = textDocumentSchema.safeParse(JSON.parse(readFileSync(join(seedDir, f), "utf8")));
      if (!parsed.success) continue; // schema errors are validate-content's own job
      for (const s of parsed.data.sentences) {
        for (const t of s.tokens) {
          if (!t.lexemeId) continue;
          const key = matchKey(t.surface);
          const ambiguity = ambiguities.get(key);
          if (!ambiguity) continue;
          const review = reviewByKey.get(key) ?? null;
          usages.push({
            file: f,
            sentence: s.target,
            surface: t.surface,
            storedLexemeId: t.lexemeId,
            ambiguity,
            review,
            ok: review !== null && review.correctLexemeId === t.lexemeId,
          });
        }
      }
    }
  }

  return { ambiguities, usages };
}

// --- CLI ---------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  const lang = targetLang();
  const root = contentRoot();
  const profile = PROFILES[lang as keyof typeof PROFILES];
  if (!profile) throw new Error(`No language profile for "${lang}"`);
  const { matchKey } = profile.text;

  const lexicon = lexiconFileSchema.parse(
    JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
  );
  const byId = new Map(lexicon.entries.map((e) => [e.id, e]));
  const { ambiguities, usages } = auditHomographs(lang, root, lexicon.entries, matchKey);

  console.log(
    `${lang}: ${ambiguities.size} ambiguous surface(s) in the lexicon, ${usages.length} usage(s) in content/${lang}/texts/seed`,
  );

  let failures = 0;
  if (usages.length > 0) {
    console.log();
    for (const u of usages) {
      const stored = byId.get(u.storedLexemeId);
      const storedDesc = stored
        ? `${stored.id} ${stored.target} [${stored.pos}] "${stored.glossEn}"`
        : u.storedLexemeId;

      if (!u.review) {
        failures++;
        console.error(`✗ ${u.file}: "${u.surface}" in "${u.sentence}" is bound to ${storedDesc}`);
        console.error(
          `    ambiguous with ${u.ambiguity.generator.id} ${u.ambiguity.generator.target} ` +
            `[${u.ambiguity.generator.pos}] "${u.ambiguity.generator.glossEn}" - no reviewed decision on record`,
        );
        continue;
      }
      if (!u.ok) {
        failures++;
        console.error(`✗ ${u.file}: "${u.surface}" in "${u.sentence}" is bound to ${storedDesc}`);
        console.error(
          `    but the reviewed decision says the correct lexeme is ${u.review.correctLexemeId} (${u.review.reason})`,
        );
        continue;
      }
      console.log(`✓ ${u.file}: "${u.surface}" in "${u.sentence}" -> ${storedDesc} (reviewed: ${u.review.reason})`);
    }
  }

  if (process.argv.includes("--list")) {
    const untouched = [...ambiguities.values()].filter((a) => !usages.some((u) => u.ambiguity.key === a.key));
    console.log(`\n${untouched.length} ambiguous surface(s) not present in any shipped seed text (noise):`);
    for (const a of untouched.sort((x, y) => x.generator.freqRank - y.generator.freqRank)) {
      console.log(
        `  ${a.surface} - generated by ${a.generator.id} ${a.generator.target} [${a.generator.pos}], ` +
          `shadowed by headword ${a.headword.id} ${a.headword.target} [${a.headword.pos}]`,
      );
    }
  }

  if (failures > 0) {
    console.error(`\n${failures} unreviewed or contradicted homograph usage(s)`);
    process.exit(1);
  }
  console.log("\nNo unreviewed homograph usages.");
}
