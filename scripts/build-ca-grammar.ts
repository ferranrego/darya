/**
 * Assemble the Catalan grammar course from its authored per-level sources.
 *
 * Grammar is the one part of the content that is written by hand rather than
 * generated: an exercise that teaches a wrong form is worse than no exercise at
 * all, and no verifier can check whether an explanation is *true*. So the
 * levels live as separate files under `scripts/data/`, and this merges them
 * into the single `grammar/all.json` the app loads.
 *
 * It also enforces the invariants the schema cannot express on its own:
 * ids unique and ordered across levels, spotError words that really appear in
 * their sentence, and matchPairs boards with no repeated side.
 *
 * Run: node scripts/build-ca-grammar.ts [--write]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CONTENT_FORMAT_VERSION, grammarCoursesFileSchema } from "../src/lib/content/schema.ts";

const write = process.argv.includes("--write");
const root = join(import.meta.dirname, "..");
const sources = ["ca-grammar-a1.json", "ca-grammar-a2.json"];

const courses = sources.map((f) =>
  JSON.parse(readFileSync(join(root, "scripts", "data", f), "utf8")),
);

const file = { formatVersion: CONTENT_FORMAT_VERSION, courses };
const parsed = grammarCoursesFileSchema.safeParse(file);
if (!parsed.success) {
  console.error("schema errors:");
  for (const issue of parsed.error.issues.slice(0, 20)) {
    console.error(`  ✗ ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const problems: string[] = [];
const seen = { block: new Set<string>(), lesson: new Set<string>(), exercise: new Set<string>() };
let lastLesson = 0;

for (const course of parsed.data.courses) {
  for (const block of course.blocks) {
    if (seen.block.has(block.id)) problems.push(`duplicate block id ${block.id}`);
    seen.block.add(block.id);
    for (const lesson of block.lessons) {
      if (seen.lesson.has(lesson.id)) problems.push(`duplicate lesson id ${lesson.id}`);
      seen.lesson.add(lesson.id);
      // Lesson ids run in one sequence across the whole course, because the
      // app walks them in order when a learner finishes a level.
      const n = Number(lesson.id.slice(3));
      if (n !== lastLesson + 1) problems.push(`${lesson.id}: out of sequence (expected gl-${String(lastLesson + 1).padStart(2, "0")})`);
      lastLesson = n;

      for (const ex of lesson.exercises) {
        if (seen.exercise.has(ex.id)) problems.push(`duplicate exercise id ${ex.id}`);
        seen.exercise.add(ex.id);
        if (!ex.id.startsWith(`ge-${lesson.id.slice(3)}-`)) {
          problems.push(`${ex.id}: id does not belong to ${lesson.id}`);
        }
        // The player highlights errorWord inside target, so it must be there.
        if (ex.type === "spotError" && !ex.target.includes(ex.errorWord.target)) {
          problems.push(`${ex.id}: errorWord "${ex.errorWord.target}" is not in the sentence`);
        }
        // A board with the same word twice has two right answers.
        if (ex.type === "matchPairs") {
          const targets = new Set(ex.pairs.map((p) => p.target));
          const ens = new Set(ex.pairs.map((p) => p.en));
          if (targets.size !== ex.pairs.length) problems.push(`${ex.id}: repeated Catalan side`);
          if (ens.size !== ex.pairs.length) problems.push(`${ex.id}: repeated English side`);
        }
        if (ex.type === "chooseTranslation") {
          const wrong = ex.direction === "toEn" ? ex.distractorsEn : ex.distractorsTarget.map((d) => d.target);
          const right = ex.direction === "toEn" ? ex.en : ex.target;
          if (wrong.length < 2) problems.push(`${ex.id}: needs at least 2 distractors`);
          if (wrong.includes(right)) problems.push(`${ex.id}: a distractor equals the answer`);
        }
      }
    }
  }
}

const lessons = parsed.data.courses.flatMap((c) => c.blocks.flatMap((b) => b.lessons));
const byType: Record<string, number> = {};
for (const l of lessons) for (const e of l.exercises) byType[e.type] = (byType[e.type] ?? 0) + 1;

console.log(
  `courses: ${parsed.data.courses.map((c) => c.level).join(", ")}  ` +
    `blocks: ${seen.block.size}  lessons: ${lessons.length}  exercises: ${seen.exercise.size}`,
);
console.log(`exercise types: ${JSON.stringify(byType)}`);

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.error(`  ✗ ${p}`);
  process.exit(1);
}

const outPath = join(root, "content", "ca", "grammar", "all.json");
if (write) {
  writeFileSync(outPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nWrote ${outPath}`);
} else {
  console.log("\n(dry run - pass --write to apply)");
}
