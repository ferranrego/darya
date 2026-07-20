/**
 * Validate all content files against their schemas + cross-file integrity.
 * Run: pnpm validate:content
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  alphabetCourseSchema,
  lexiconFileSchema,
  levelsFileSchema,
  textDocumentSchema,
  type AlphabetCourse,
  type LexiconFile,
  type LevelsFile,
  type TextDocument,
} from "../src/lib/content/schema.ts";
import { matchKey, normalizeDari } from "../src/lib/text/normalize.ts";

const root = join(import.meta.dirname, "..", "content");
let errors = 0;

function fail(msg: string) {
  errors++;
  console.error(`✗ ${msg}`);
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

// --- Lexicon ---------------------------------------------------------------
const lexiconPath = join(root, "lexicon", "lexicon.json");
let lexicon: LexiconFile | null = null;
if (existsSync(lexiconPath)) {
  const parsed = lexiconFileSchema.safeParse(loadJson(lexiconPath));
  if (!parsed.success) {
    fail(`lexicon.json: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  } else {
    lexicon = parsed.data;
    const ids = new Set<string>();
    const keys = new Map<string, string>();
    for (const e of lexicon.entries) {
      if (ids.has(e.id)) fail(`lexicon: duplicate id ${e.id}`);
      ids.add(e.id);
      if (e.dariNormalized !== normalizeDari(e.dariNormalized)) {
        fail(`lexicon ${e.id}: dariNormalized not normalized (${e.dariNormalized})`);
      }
      const key = matchKey(e.dariNormalized);
      const clash = keys.get(key);
      if (clash) fail(`lexicon: ${e.id} and ${clash} share match key "${key}"`);
      keys.set(key, e.id);
    }
    console.log(`✓ lexicon.json (${lexicon.entries.length} entries)`);
  }
} else {
  fail("lexicon.json missing");
}
const lexemeIds = new Set(lexicon?.entries.map((e) => e.id) ?? []);

// --- Levels ----------------------------------------------------------------
const levelsPath = join(root, "levels", "levels.json");
let levels: LevelsFile | null = null;
if (existsSync(levelsPath)) {
  const parsed = levelsFileSchema.safeParse(loadJson(levelsPath));
  if (!parsed.success) fail(`levels.json: ${parsed.error.message}`);
  else {
    levels = parsed.data;
    console.log(`✓ levels.json (${levels.levels.length} levels)`);
  }
} else fail("levels.json missing");
const levelIds = new Set(levels?.levels.map((l) => l.id) ?? []);

// --- Alphabet course -------------------------------------------------------
const coursePath = join(root, "alphabet", "course.json");
if (existsSync(coursePath)) {
  const parsed = alphabetCourseSchema.safeParse(loadJson(coursePath));
  if (!parsed.success) {
    fail(`course.json: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  } else {
    const course: AlphabetCourse = parsed.data;
    const taught = new Set<string>();
    let letterCount = 0;
    for (const unit of course.units) {
      for (const l of unit.letters) {
        taught.add(l.char);
        letterCount++;
      }
      for (const ex of unit.exercises) {
        if ("targetChar" in ex && !taught.has(ex.targetChar)) {
          fail(`course ${unit.id}/${ex.id}: targetChar ${ex.targetChar} not yet taught`);
        }
        if (ex.type === "readWord" && !ex.choices.includes(ex.translit)) {
          fail(`course ${unit.id}/${ex.id}: choices missing correct translit`);
        }
        if (ex.type === "pickForm") {
          const chars = [...ex.word];
          if (chars[ex.targetIndex] !== ex.targetChar) {
            fail(`course ${unit.id}/${ex.id}: targetIndex ${ex.targetIndex} is "${chars[ex.targetIndex]}", expected "${ex.targetChar}"`);
          }
        }
      }
    }
    console.log(`✓ course.json (${course.units.length} units, ${letterCount} letters)`);
  }
} else fail("course.json missing");

// --- Seed texts ------------------------------------------------------------
const seedDir = join(root, "texts", "seed");
if (existsSync(seedDir)) {
  const files = readdirSync(seedDir).filter((f) => f.endsWith(".json"));
  let ok = 0;
  for (const f of files) {
    const parsed = textDocumentSchema.safeParse(loadJson(join(seedDir, f)));
    if (!parsed.success) {
      fail(`${f}: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    const doc: TextDocument = parsed.data;
    if (!levelIds.has(doc.level)) fail(`${f}: unknown level ${doc.level}`);
    for (const s of doc.sentences) {
      for (const t of s.tokens) {
        if (t.lexemeId && !lexemeIds.has(t.lexemeId)) {
          fail(`${f}: token "${t.surface}" references missing lexeme ${t.lexemeId}`);
        }
      }
    }
    for (const v of doc.vocabUsed) {
      if (!lexemeIds.has(v)) fail(`${f}: vocabUsed references missing lexeme ${v}`);
    }
    ok++;
  }
  console.log(`✓ seed texts (${ok}/${files.length} valid)`);
} else {
  fail("content/texts/seed missing");
}

if (errors > 0) {
  console.error(`\n${errors} content error(s)`);
  process.exit(1);
}
console.log("\nAll content valid.");
