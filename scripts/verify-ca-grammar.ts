/**
 * Verify the Catalan grammar course.
 *
 * Grammar content is authored, not generated, but it is the part of the app a
 * learner trusts most - an exercise that teaches a wrong form is worse than no
 * exercise. Every Catalan string in the course is therefore run through the
 * same checks the lexicon uses:
 *
 *   - obligatory apostrophation (l'home, d'aigua, l'explicació)
 *   - no characters from another language
 *   - every token resolvable by the Catalan engine, so tap-to-reveal works
 *   - fillBlank answers and distractors must be distinct, and the sentence must
 *     carry exactly one blank
 *
 * Run: node scripts/verify-ca-grammar.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lexiconFileSchema, grammarCoursesFileSchema } from "../src/lib/content/schema.ts";
import { buildLexiconIndex } from "../src/lib/lang/ca/lexicon-index.ts";
import { matchKey, tokenizeCatalan } from "../src/lib/lang/ca/normalize.ts";
import { apostropheProblems } from "./verify-ca-entries.ts";

const root = join(import.meta.dirname, "..", "content", "ca");
const lexicon = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")),
);
const index = buildLexiconIndex(lexicon.entries);
const courses = grammarCoursesFileSchema.parse(
  JSON.parse(readFileSync(join(root, "grammar", "all.json"), "utf8")),
).courses;

const problems: string[] = [];
const unresolved = new Map<string, number>();
let sentences = 0;

/**
 * Every Catalan string that is supposed to be *correct*, with a label saying
 * where it came from.
 *
 * A grammar course is full of deliberately wrong Catalan: distractor chips,
 * the extra tiles in a word bank, and the whole point of a spotError sentence.
 * Checking those for apostrophation flags the exercise for teaching exactly the
 * error it was written to teach. So the wrong-by-design branches are skipped,
 * and the rest is held to the same standard as the lexicon.
 */
const WRONG_BY_DESIGN = new Set(["distractors", "distractorsTarget", "extraWords", "errorWord"]);

function walk(node: unknown, where: string, out: [string, string][]): void {
  if (Array.isArray(node)) return node.forEach((c, i) => walk(c, `${where}[${i}]`, out));
  if (!node || typeof node !== "object") return;

  // A spotError sentence contains one wrong word by construction.
  const isSpotError = "type" in node && (node as { type: string }).type === "spotError";

  for (const [k, v] of Object.entries(node)) {
    if (WRONG_BY_DESIGN.has(k)) continue;
    if (isSpotError && k === "target") continue;
    if (typeof v === "string") {
      if (k === "target" || k === "answer") out.push([v, `${where}.${k}`]);
    } else {
      walk(v, node && "id" in node ? String((node as { id: string }).id) : `${where}.${k}`, out);
    }
  }
}

/**
 * Mid-sentence capitalised words are proper nouns (Marta, Girona), which a
 * lexicon should not carry - a "Girona" card glossed "Girona" teaches nothing.
 * The first word of a sentence is capitalised by position, so it stays checked.
 */
function properNouns(text: string): Set<string> {
  const names = new Set<string>();
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const words = sentence.trim().split(/\s+/);
    // The first word is capitalised by position, but it may be a clitic glued
    // to a name ("L'Anna"), in which case the name after the apostrophe still
    // counts.
    const first = words[0]?.split("'").slice(1).join("'");
    for (const w of [...(first ? [first] : []), ...words.slice(1)]) {
      const bare = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
      if (bare && bare[0] !== bare[0].toLowerCase()) names.add(bare.toLowerCase());
    }
  }
  return names;
}

for (const course of courses) {
  if (course.language !== "ca") problems.push(`${course.level}: language is "${course.language}"`);
  const strings: [string, string][] = [];
  walk(course, course.level, strings);

  for (const [text, where] of strings) {
    sentences++;
    for (const p of apostropheProblems(text)) problems.push(`${where}: ${p}`);
    if (/ñ|ê|â|î|ô|û|ã|õ/i.test(text)) problems.push(`${where}: non-Catalan characters in "${text}"`);
    const names = properNouns(text);
    for (const token of tokenizeCatalan(text)) {
      if (token === "___" || /^_+$/.test(token)) continue;
      if (names.has(token.toLowerCase())) continue;
      if (!index.resolve(token)) {
        unresolved.set(token, (unresolved.get(token) ?? 0) + 1);
      }
    }
  }

  for (const block of course.blocks) {
    for (const lesson of block.lessons) {
      for (const ex of lesson.exercises) {
        if (ex.type === "fillBlank") {
          const blanks = (ex.target.match(/___/g) ?? []).length;
          if (blanks !== 1) problems.push(`${ex.id}: ${blanks} blanks, expected exactly 1`);
          const answer = matchKey(ex.answer.target);
          for (const d of ex.distractors) {
            if (matchKey(d.target) === answer) problems.push(`${ex.id}: distractor equals answer`);
          }
        }
        if (ex.type === "chooseTranslation") {
          if (ex.direction === "toEn" && ex.distractorsEn.length < 2) {
            problems.push(`${ex.id}: needs at least 2 English distractors`);
          }
        }
      }
    }
  }
}

const lessons = courses.flatMap((c) => c.blocks.flatMap((b) => b.lessons));
console.log(
  `courses: ${courses.map((c) => c.level).join(", ")}  ` +
    `lessons: ${lessons.length}  exercises: ${lessons.reduce((n, l) => n + l.exercises.length, 0)}  ` +
    `strings checked: ${sentences}`,
);

if (unresolved.size) {
  const total = [...unresolved.values()].reduce((a, b) => a + b, 0);
  console.log(`\nunresolved tokens (${unresolved.size} distinct, ${total} occurrences):`);
  for (const [t, n] of [...unresolved.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60)) {
    console.log(`  ${t} (${n})`);
  }
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems.slice(0, 30)) console.error(`  ✗ ${p}`);
  process.exit(1);
}
console.log("\nNo problems.");
