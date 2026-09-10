/**
 * Emit the seed-text sentences that still have no transliteration, for
 * authoring, and apply the authored lines back into `seed-texts-prs.ts`.
 *
 * Companion to `repair-translit.ts`, which does the same job for the lexicon.
 * The defect here is the more damaging of the two: 273 of the 400 beginner
 * sentences carry no pronunciation at all, and onboarding asks new learners
 * whether they can read the script - so the people worst affected are exactly
 * the ones who answered "not yet". The reader guards on the field and renders
 * blank space, so nothing ever looked broken.
 *
 * This script never calls a model. It only moves text around and re-checks it.
 *
 *   Emit:  node scripts/repair-seed-translit.ts --emit <n> [--out <file>]
 *   Apply: node scripts/repair-seed-translit.ts --apply <file>
 *
 * Apply edits the *source* file, not the built JSON, so `pnpm build:texts`
 * stays the single way content reaches `content/prs/texts/seed/`. It matches a
 * sentence by slug and exact target text, refuses anything it cannot place,
 * and refuses a line that trips the Iranian-transliteration rule.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROFILES } from "../src/lib/lang/index.ts";
import { lexiconFileSchema } from "../src/lib/content/schema.ts";
import { isFlattenedTranslit } from "../src/lib/lang/prs/translit-check.ts";
import { contentRoot } from "./content-path.ts";
import { seedTexts } from "./data/seed-texts-prs.ts";

const SOURCE = join(process.cwd(), "scripts", "data", "seed-texts-prs.ts");

const profile = PROFILES.prs;
const lexicon = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(contentRoot(), "lexicon", "lexicon.json"), "utf8")),
);
const index = profile.text.buildIndex(lexicon.entries);

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? "");
};

if (flag("--emit") !== null) {
  const limit = Number(flag("--emit")) || 40;
  const out = flag("--out") || "seed-translit-batch.json";
  const batch: unknown[] = [];
  for (const text of seedTexts) {
    if (batch.length >= limit) break;
    const needsTitle = !text.titleTranslit;
    const missing = text.sentences.filter((s) => !s.translit);
    if (!needsTitle && missing.length === 0) continue;
    batch.push({
      slug: text.slug,
      level: text.level,
      titleTarget: text.titleTarget,
      titleEn: text.titleEn,
      titleTranslit: text.titleTranslit ?? "",
      sentences: missing.map((s) => ({
        target: s.target,
        en: s.en,
        // Each token's own lexicon transliteration, which is already
        // philologist-checked. Correct for uninflected words and a starting
        // point for the rest - never authoritative, because an inflected form
        // has no transliteration of its own anywhere in the repo.
        hints: profile.text
          .tokenize(s.target)
          .map((t) => `${t}=${index.resolve(t)?.translit ?? "?"}`),
        translit: "",
      })),
    });
  }
  writeFileSync(out, JSON.stringify(batch, null, 2) + "\n");
  const sentences = batch.reduce<number>(
    (n, t) => n + (t as { sentences: unknown[] }).sentences.length,
    0,
  );
  console.log(`wrote ${batch.length} texts (${sentences} sentences) to ${out}`);
} else if (flag("--apply") !== null) {
  type Repair = {
    slug: string;
    titleTranslit?: string;
    sentences: Array<{ target: string; translit: string }>;
  };
  const repairs: Repair[] = JSON.parse(readFileSync(flag("--apply")!, "utf8"));
  const bySlug = new Map(repairs.map((r) => [r.slug, r]));
  const problems: string[] = [];
  let titles = 0;
  let lines = 0;

  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const src = readFileSync(SOURCE, "utf8").split("\n");
  let slug: string | null = null;

  for (let i = 0; i < src.length; i++) {
    const slugMatch = src[i].match(/^\s*slug: "([^"]+)",$/);
    if (slugMatch) {
      slug = slugMatch[1];
      continue;
    }
    const repair = slug ? bySlug.get(slug) : undefined;
    if (!repair) continue;

    // Title: insert the line after titleTarget, matching the field order the
    // rest of the file uses.
    const titleMatch = src[i].match(/^(\s*)titleTarget: "(.*)",$/);
    if (titleMatch && repair.titleTranslit) {
      if (isFlattenedTranslit(repair.titleTranslit, titleMatch[2])) {
        problems.push(`${slug}: title transliteration is Iranian-flattened`);
        continue;
      }
      src[i] = `${src[i]}\n${titleMatch[1]}titleTranslit: "${escape(repair.titleTranslit)}",`;
      titles++;
      continue;
    }

    // The last entry in a sentences array has no trailing comma, so both
    // shapes have to match - one sentence was silently skipped before this.
    const line = src[i].match(/^(\s*)\{ target: "(.*?)", en: (".*?"),? \},?$/);
    if (!line) continue;
    const fix = repair.sentences.find((s) => s.target === line[2]);
    if (!fix?.translit) continue;
    if (isFlattenedTranslit(fix.translit, line[2])) {
      problems.push(`${slug}: "${line[2]}" repair is Iranian-flattened`);
      continue;
    }
    const comma = src[i].trimEnd().endsWith("},") ? "," : "";
    src[i] =
      `${line[1]}{ target: "${line[2]}", translit: "${escape(fix.translit)}", ` +
      `en: ${line[3]} }${comma}`;
    lines++;
  }

  const wanted = repairs.reduce(
    (n, r) => n + r.sentences.filter((s) => s.translit).length,
    0,
  );
  if (lines !== wanted) {
    problems.push(`placed ${lines} of ${wanted} sentence repairs - the rest matched no line`);
  }
  if (problems.length > 0) {
    console.error(problems.join("\n"));
    process.exit(1);
  }
  writeFileSync(SOURCE, src.join("\n"));
  console.log(`applied ${lines} sentences and ${titles} titles`);
} else {
  console.error("usage: --emit <n> [--out <file>] | --apply <file>");
  process.exit(1);
}
