/**
 * Append drafted seed texts to the authored source file.
 *
 * Authoring happens in batches, and every batch so far has been assembled by
 * hand-editing `scripts/data/seed-texts-prs.ts` with a throwaway script. That
 * is how a literal `.replace()` call once ended up inside the data file - it
 * evaluated correctly, so nothing caught it, and a data file quietly contained
 * an expression.
 *
 * This does the mechanical part properly: assigns the next free slug and `seq`
 * for the level, escapes nothing (the strings are written as-is, which is why
 * they must already be valid), and refuses a draft that breaks a rule the
 * build would only catch later.
 *
 *   node scripts/apply-draft-texts.ts <draft.json> [--level L2] [--dry-run]
 *
 * The draft is a JSON array of { titleTarget, titleTranslit, titleEn,
 * sentences: [{ target, translit, en }] }. Everything else - tokenizing,
 * lexeme resolution, level-shape checks - is `build-seed-texts.ts`'s job, and
 * is deliberately not duplicated here.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface DraftSentence {
  target: string;
  translit: string;
  en: string;
}
interface DraftText {
  titleTarget: string;
  titleTranslit: string;
  titleEn: string;
  sentences: DraftSentence[];
}

const args = process.argv.slice(2);
const draftPath = args.find((a) => !a.startsWith("--"));
const level = args.includes("--level") ? args[args.indexOf("--level") + 1] : "L2";
const dryRun = args.includes("--dry-run");
if (!draftPath) throw new Error("usage: apply-draft-texts.ts <draft.json> [--level L2] [--dry-run]");

const draft = JSON.parse(readFileSync(draftPath, "utf8")) as DraftText[];
if (!Array.isArray(draft) || draft.length === 0) throw new Error(`${draftPath}: not a non-empty array`);

const sourcePath = join(import.meta.dirname, "data", "seed-texts-prs.ts");
let source = readFileSync(sourcePath, "utf8");

/**
 * The next free slug number for this level.
 *
 * Read from the file rather than passed in: two batches applied in one sitting
 * would otherwise collide, and a duplicate slug is the defect that silently
 * deleted four finished texts before the build started rejecting it.
 */
const used = [...source.matchAll(/slug: "l(\d)-(\d+)"/g)]
  .filter((m) => `L${m[1]}` === level)
  .map((m) => Number(m[2]));
let next = used.length === 0 ? 1 : Math.max(...used) + 1;

/** Refuse what the build would reject later, while the draft is still cheap to fix. */
const problems: string[] = [];
draft.forEach((text, i) => {
  const where = `draft[${i}] "${text.titleEn}"`;
  if (!text.titleTarget || !text.titleEn || !Array.isArray(text.sentences)) {
    problems.push(`${where}: missing title or sentences`);
    return;
  }
  if (text.sentences.length < 4 || text.sentences.length > 6) {
    problems.push(`${where}: ${text.sentences.length} sentences, wanted 4-6`);
  }
  text.sentences.forEach((s, j) => {
    if (!s.target || !s.translit || !s.en) problems.push(`${where} sentence ${j + 1}: missing a field`);
    // The transliteration is the app's only pronunciation guide; a Dari word
    // left in it, or a Latin word left in the script, means the two halves
    // were not written together.
    if (/[؀-ۿ]/u.test(s.translit)) problems.push(`${where} sentence ${j + 1}: script in the transliteration`);
    // Straight quotes would terminate the generated string literal.
    for (const field of [s.target, s.translit, s.en]) {
      if (field.includes('"') || field.includes("\\")) {
        problems.push(`${where} sentence ${j + 1}: a quote or backslash needs escaping by hand`);
      }
    }
    // A bare می or نمی is the ZWNJ bug, which renders almost identically.
    if (/(^|\s)ن?می(\s)/u.test(s.target)) {
      problems.push(`${where} sentence ${j + 1}: "می" followed by a space - the ZWNJ is missing`);
    }
    /**
     * Subordinators below L3.
     *
     * L1 bans them outright and L2's grammar list does not include them, but
     * nothing enforced it - `validate-content.ts` checks sentence length and
     * count, not which structures a sentence uses. A whole batch reached
     * review carrying six که-clauses, and so did the first draft written
     * against a brief that says in bold not to use them, this one included.
     */
    if (level !== "L1" && level !== "L2") {
      // Allowed from L3 up; nothing to check.
    } else if (/(^|\s)(که|چون)(\s)/u.test(s.target)) {
      problems.push(`${where} sentence ${j + 1}: subordinator - ${level} is main clauses only`);
    }
    /**
     * داشتن and بودن never take mē-.
     *
     * Both are suppletive: the present of داشتن is bare دارم/داری/دارد and its
     * negative is نداریم, not نمی‌داریم - `levels.json` states this at L1 and
     * repeats it at L2, and the build rejects the form as unresolvable, which
     * is a confusing way to be told you conjugated a verb that does not
     * conjugate that way.
     */
    if (/ن?می\u200c(دار|هست|باش)/u.test(s.target)) {
      problems.push(`${where} sentence ${j + 1}: داشتن/بودن are suppletive - no mē- form`);
    }
    /**
     * The object marker را below L2.
     *
     * `levels.json` introduces را in L2's `grammarAllowed`; L1 has only the
     * present mē- verbs, the copula and داشتن. A beginner meeting را before
     * the lesson that explains it reads it as a word rather than a marker.
     */
    if (level === "L1" && /(^|\s)را(\s|$)/u.test(s.target)) {
      problems.push(`${where} sentence ${j + 1}: را is introduced at L2, not L1`);
    }
    /**
     * `این جای` / `آن جای` instead of `اینجا` / `آنجا`.
     *
     * Written apart it reads as the ezafe construct "this place of…", which
     * garden-paths a beginner - and the lexicon transliterates the identical
     * string both ways, so the learner meets the contradiction.
     */
    if (/(این|آن)\s+جای/u.test(s.target)) {
      problems.push(`${where} sentence ${j + 1}: "این جای" - اینجا/آنجا are single words`);
    }
  });
});
if (problems.length > 0) {
  for (const p of problems) console.error(`✗ ${p}`);
  console.error(`\n${problems.length} problem(s); nothing written`);
  process.exit(1);
}

const blocks = draft.map((text) => {
  const n = String(next++).padStart(3, "0");
  const rows = text.sentences
    .map((s) => `      { target: "${s.target}", translit: "${s.translit}", en: "${s.en}" },`)
    .join("\n");
  return `  {
    slug: "${level.toLowerCase()}-${n}",
    level: "${level}",
    seq: ${Number(n)},
    titleTarget: "${text.titleTarget}",
    titleTranslit: "${text.titleTranslit}",
    titleEn: "${text.titleEn}",
    sentences: [
${rows}
    ],
  },`;
});

console.log(`${draft.length} text(s) -> ${level.toLowerCase()}-${String(next - draft.length).padStart(3, "0")} … ${level.toLowerCase()}-${String(next - 1).padStart(3, "0")}`);
if (dryRun) {
  console.log("(dry run, nothing written)");
  process.exit(0);
}

const end = source.lastIndexOf("\n];");
if (end === -1) throw new Error("could not find the end of the seedTexts array");
source = `${source.slice(0, end)}\n${blocks.join("\n")}\n];\n`;
writeFileSync(sourcePath, source);
console.log(`appended to ${sourcePath} - now run: pnpm build:texts && pnpm validate:content`);
