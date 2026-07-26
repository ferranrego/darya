/**
 * Validate all content files against their schemas + cross-file integrity.
 * Run: pnpm validate:content
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  alphabetCourseSchema,
  grammarCourseSchema,
  lexiconFileSchema,
  levelsFileSchema,
  textDocumentSchema,
  type AlphabetCourse,
  type GrammarExercise,
  type LexiconFile,
  type LevelsFile,
  type TextDocument,
} from "../src/lib/content/schema.ts";
import { buildAllowedFormKeys } from "../src/lib/text/dari-forms.ts";
import { buildLexiconIndex } from "../src/lib/text/lexicon-index.ts";
import { matchKey, normalizeDari, tokenizeDari } from "../src/lib/text/normalize.ts";

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
      if (e.presentStem !== undefined) {
        if (!/^[؀-ۿ‌]+$/.test(e.presentStem)) {
          fail(`lexicon ${e.id}: presentStem not Persian script (${e.presentStem})`);
        }
        if (e.presentStem !== normalizeDari(e.presentStem)) {
          fail(`lexicon ${e.id}: presentStem not normalized (${e.presentStem})`);
        }
      }
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

// --- Grammar courses (one file per CEFR level) -----------------------------
{
  const index = lexicon ? buildLexiconIndex(lexicon.entries) : null;
  const allowedForms = lexicon ? buildAllowedFormKeys(lexicon.entries) : new Set<string>();

  // ids must be globally unique across every level file.
  const blockIds = new Set<string>();
  const lessonIds = new Set<string>();
  const exerciseIds = new Set<string>();

  function checkVocab(where: string, dari: string, warn: () => void) {
    if (!index) return;
    for (const token of tokenizeDari(dari)) {
      if (token === "___") continue;
      if (index.resolve(token)) continue;
      if (allowedForms.has(matchKey(token))) continue;
      warn();
      console.warn(`⚠ grammar ${where}: "${token}" not in lexicon`);
    }
  }

  function checkNormalized(where: string, dari: string) {
    if (dari !== normalizeDari(dari)) fail(`grammar ${where}: Dari not normalized ("${dari}")`);
  }

  function checkExercise(where: string, ex: GrammarExercise, warn: () => void) {
    switch (ex.type) {
      case "fillBlank": {
        checkNormalized(where, ex.dari);
        checkNormalized(`${where} answer`, ex.answer.dari);
        const answerKey = normalizeDari(ex.answer.dari);
        for (const d of ex.distractors) {
          checkNormalized(`${where} distractor`, d.dari);
          if (normalizeDari(d.dari) === answerKey) fail(`${where}: distractor equals answer ("${d.dari}")`);
        }
        checkVocab(where, ex.dari.replace("___", ex.answer.dari), warn);
        break;
      }
      case "buildSentence": {
        const wordKeys = new Set(ex.words.map((w) => normalizeDari(w.dari)));
        for (const w of [...ex.words, ...ex.extraWords]) checkNormalized(where, w.dari);
        for (const x of ex.extraWords) {
          if (wordKeys.has(normalizeDari(x.dari))) fail(`${where}: extraWord duplicates a sentence word ("${x.dari}")`);
        }
        // Every alternate ordering must be a permutation of the sentence words.
        const sortedWords = ex.words.map((w) => normalizeDari(w.dari)).sort();
        for (const order of ex.altOrders) {
          const sortedOrder = order.map((d) => normalizeDari(d)).sort();
          const isPermutation =
            sortedOrder.length === sortedWords.length &&
            sortedOrder.every((d, i) => d === sortedWords[i]);
          if (!isPermutation) fail(`${where}: altOrder is not a permutation of words ("${order.join(" ")}")`);
        }
        checkVocab(where, ex.words.map((w) => w.dari).join(" "), warn);
        break;
      }
      case "chooseTranslation": {
        checkNormalized(where, ex.dari);
        if (ex.direction === "toEn" && ex.distractorsEn.length < 2) {
          fail(`${where}: toEn needs at least 2 distractorsEn`);
        }
        if (ex.direction === "toDari" && ex.distractorsDari.length < 2) {
          fail(`${where}: toDari needs at least 2 distractorsDari`);
        }
        if (ex.distractorsEn.includes(ex.en)) fail(`${where}: distractorsEn contains the answer`);
        const dariKey = normalizeDari(ex.dari);
        for (const d of ex.distractorsDari) {
          checkNormalized(`${where} distractor`, d.dari);
          if (normalizeDari(d.dari) === dariKey) fail(`${where}: distractorsDari contains the answer`);
        }
        checkVocab(where, ex.dari, warn);
        break;
      }
      case "matchPairs": {
        const dariSeen = new Set<string>();
        const enSeen = new Set<string>();
        for (const p of ex.pairs) {
          checkNormalized(where, p.dari);
          const dk = normalizeDari(p.dari);
          if (dariSeen.has(dk)) fail(`${where}: duplicate pair Dari "${p.dari}"`);
          if (enSeen.has(p.en)) fail(`${where}: duplicate pair English "${p.en}"`);
          dariSeen.add(dk);
          enSeen.add(p.en);
          checkVocab(where, p.dari, warn);
        }
        break;
      }
      case "spotError": {
        checkNormalized(where, ex.dari);
        checkNormalized(`${where} correction`, ex.correction.dari);
        const tokens = tokenizeDari(ex.dari).map((t) => normalizeDari(t));
        if (!tokens.includes(normalizeDari(ex.errorWord.dari))) {
          fail(`${where}: errorWord "${ex.errorWord.dari}" is not a token of the sentence`);
        }
        if (normalizeDari(ex.errorWord.dari) === normalizeDari(ex.correction.dari)) {
          fail(`${where}: correction equals errorWord`);
        }
        // Vocab-check the corrected sentence, not the (deliberately wrong) one.
        const corrected = ex.dari.replace(ex.errorWord.dari, ex.correction.dari);
        checkVocab(where, corrected, warn);
        break;
      }
    }
  }

  for (const level of ["a1", "a2", "b1", "b2", "c1", "c2"]) {
    const path = join(root, "grammar", `${level}.json`);
    if (!existsSync(path)) {
      // A1 must exist; higher levels are optional until authored.
      if (level === "a1") fail(`grammar/${level}.json missing`);
      continue;
    }
    const parsed = grammarCourseSchema.safeParse(loadJson(path));
    if (!parsed.success) {
      fail(`grammar/${level}.json: ${parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      continue;
    }
    const course = parsed.data;
    if (course.level.toLowerCase() !== level) {
      fail(`grammar/${level}.json: level field is "${course.level}", expected ${level.toUpperCase()}`);
    }
    let warnings = 0;
    const warn = () => {
      warnings++;
    };
    let lessonCount = 0;
    let exerciseCount = 0;
    for (const block of course.blocks) {
      if (blockIds.has(block.id)) fail(`grammar: duplicate block id ${block.id}`);
      blockIds.add(block.id);
      for (const lesson of block.lessons) {
        if (lessonIds.has(lesson.id)) fail(`grammar: duplicate lesson id ${lesson.id}`);
        lessonIds.add(lesson.id);
        lessonCount++;
        for (const slide of lesson.slides) {
          for (const exm of slide.examples) {
            checkNormalized(`${lesson.id}/${slide.id}`, exm.dari);
            if (exm.highlight && !exm.dari.includes(exm.highlight)) {
              fail(`grammar ${lesson.id}/${slide.id}: highlight "${exm.highlight}" not in "${exm.dari}"`);
            }
            checkVocab(`${lesson.id}/${slide.id}`, exm.dari, warn);
          }
        }
        for (const ex of lesson.exercises) {
          if (exerciseIds.has(ex.id)) fail(`grammar: duplicate exercise id ${ex.id}`);
          exerciseIds.add(ex.id);
          exerciseCount++;
          checkExercise(`${lesson.id}/${ex.id}`, ex, warn);
        }
      }
    }
    const warnNote = warnings > 0 ? `, ${warnings} vocab warning(s)` : "";
    console.log(`✓ grammar/${level}.json (${course.blocks.length} blocks, ${lessonCount} lessons, ${exerciseCount} exercises${warnNote})`);
  }
}

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
