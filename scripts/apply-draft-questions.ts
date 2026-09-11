/**
 * Apply drafted comprehension questions to the authored seed-text source.
 *
 * Questions are the one piece of learner-facing content where a defect is
 * completely silent: an `answerIndex` past the end marks every answer wrong, an
 * `evidenceSentence` pointing at the wrong line shows a correction that
 * corrects nothing, and two options meaning the same thing mark a right answer
 * wrong. None of it throws, and the learner concludes they misunderstood.
 *
 *   node scripts/apply-draft-questions.ts <questions.json> [--dry-run]
 *
 * The draft maps text id -> array of questions. `validate-content.ts` checks
 * the same invariants after the build; this checks them while the draft is
 * still cheap to fix, and refuses to write anything if one fails.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

import { contentRoot } from "./content-path.ts";
import { textDocumentSchema, type ComprehensionQuestion } from "../src/lib/content/schema.ts";

const args = process.argv.slice(2);
const draftPath = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
if (!draftPath) throw new Error("usage: apply-draft-questions.ts <questions.json> [--dry-run]");

const draft = JSON.parse(readFileSync(draftPath, "utf8")) as Record<string, ComprehensionQuestion[]>;
const root = contentRoot();
const sourcePath = join(import.meta.dirname, "data", "seed-texts-prs.ts");
let source = readFileSync(sourcePath, "utf8");

const problems: string[] = [];
const applicable: [string, ComprehensionQuestion[]][] = [];

for (const [textId, questions] of Object.entries(draft)) {
  const built = join(root, "texts", "seed", `${textId}.json`);
  if (!existsSync(built)) {
    problems.push(`${textId}: no such text`);
    continue;
  }
  const doc = textDocumentSchema.parse(JSON.parse(readFileSync(built, "utf8")));
  if (doc.questions.length > 0) {
    // Never overwrite reviewed content with a fresh draft.
    problems.push(`${textId}: already has hand-written questions`);
    continue;
  }
  questions.forEach((q, i) => {
    const where = `${textId} q${i + 1}`;
    if (!q.questionEn || !q.questionTarget) problems.push(`${where}: missing question text`);
    if (!q.questionTranslit) problems.push(`${where}: no transliteration on the question`);
    if (!Array.isArray(q.options) || q.options.length !== 4) {
      problems.push(`${where}: ${q.options?.length ?? 0} options, wanted 4`);
      return;
    }
    if (new Set(q.options.map((o) => o.target)).size !== 4) {
      problems.push(`${where}: two options say the same thing in Dari`);
    }
    if (new Set(q.options.map((o) => o.en.trim().toLowerCase())).size !== 4) {
      problems.push(`${where}: two options say the same thing in English`);
    }
    for (const [oi, o] of q.options.entries()) {
      if (!o.translit) problems.push(`${where} option ${oi + 1}: no transliteration`);
      if (/[؀-ۿ]/u.test(o.translit ?? "")) problems.push(`${where} option ${oi + 1}: script in the transliteration`);
      for (const field of [o.target, o.translit ?? "", o.en]) {
        if (field.includes('"') || field.includes("\\")) {
          problems.push(`${where} option ${oi + 1}: a quote or backslash needs escaping by hand`);
        }
      }
    }
    if (q.answerIndex < 0 || q.answerIndex > 3) problems.push(`${where}: answerIndex ${q.answerIndex}`);
    if (q.evidenceSentence < 0 || q.evidenceSentence >= doc.sentences.length) {
      problems.push(`${where}: evidenceSentence ${q.evidenceSentence}, text has ${doc.sentences.length}`);
    }
    if (q.source !== "authored") problems.push(`${where}: source must be "authored"`);
    // The two Dari defects that got through review before.
    if (/چه\s+را/u.test(q.questionTarget)) {
      problems.push(`${where}: "چه را" - interrogative چه takes no را`);
    }
    for (const text of [q.questionTarget, ...q.options.map((o) => o.target)]) {
      if (/(^|\s)ن?می(\s)/u.test(text)) problems.push(`${where}: "می" with a space - the ZWNJ is missing`);
    }
  });
  applicable.push([textId, questions]);
}

if (problems.length > 0) {
  for (const p of problems.slice(0, 40)) console.error(`✗ ${p}`);
  if (problems.length > 40) console.error(`  … ${problems.length - 40} more`);
  console.error(`\n${problems.length} problem(s); nothing written`);
  process.exit(1);
}

/** Render as a TS literal, matching the hand-written entries already in the file. */
function render(questions: ComprehensionQuestion[]): string {
  const items = questions.map((q) => {
    const options = q.options
      .map(
        (o) =>
          `          { target: "${o.target}", translit: "${o.translit}", en: "${o.en}" },`,
      )
      .join("\n");
    return `      {
        questionEn: "${q.questionEn}",
        questionTarget: "${q.questionTarget}",
        questionTranslit: "${q.questionTranslit}",
        options: [
${options}
        ],
        answerIndex: ${q.answerIndex},
        evidenceSentence: ${q.evidenceSentence},
        source: "authored",
      },`;
  });
  return `    questions: [\n${items.join("\n")}\n    ],\n`;
}

let applied = 0;
for (const [textId, questions] of applicable) {
  const slug = textId.replace("tx-seed-", "");
  const anchor = `    slug: "${slug}",`;
  const at = source.indexOf(anchor);
  if (at === -1) {
    console.error(`✗ ${textId}: no entry in the source file`);
    continue;
  }
  const afterSentences = source.indexOf("\n    ],\n", at) + "\n    ],\n".length;
  source = source.slice(0, afterSentences) + render(questions) + source.slice(afterSentences);
  applied++;
}

console.log(`${applied} text(s) given ${applicable.reduce((n, [, q]) => n + q.length, 0)} question(s)`);
if (dryRun) {
  console.log("(dry run, nothing written)");
  process.exit(0);
}
writeFileSync(sourcePath, source);
console.log(`appended to ${sourcePath} - now run: pnpm build:texts && pnpm validate:content`);
