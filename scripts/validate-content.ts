/**
 * Validate all content files against their schemas + cross-file integrity.
 * Run: pnpm validate:content
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  alphabetCourseSchema,
  grammarCoursesFileSchema,
  lexiconFileSchema,
  levelsFileSchema,
  textDocumentSchema,
  type AlphabetCourse,
  type GrammarExercise,
  type LexiconFile,
  type LevelsFile,
  type TextDocument,
} from "../src/lib/content/schema.ts";

// ZWNJ is a Perso-Arabic concept, and the compound-spelling check below is a
// Dari orthography rule - both come from the language module, not the neutral
// text façade. Phase 3 gives this script a --lang argument.
import { ZWNJ } from "../src/lib/lang/prs/normalize.ts";
import { PROFILES } from "../src/lib/lang/index.ts";
import { contentRoot, targetLang } from "./content-path.ts";

const lang = targetLang();
const root = contentRoot();
const profile = PROFILES[lang as keyof typeof PROFILES];
if (!profile) throw new Error(`No language profile for "${lang}"`);

/**
 * Text operations for the language being validated, NOT for the build's
 * language. `src/lib/text` resolves from NEXT_PUBLIC_TARGET_LANG, so importing
 * it here would tokenize Catalan content with the Dari tokenizer whenever
 * --lang disagrees with the environment - which silently reported every
 * apostrophised Catalan word as out-of-lexicon.
 */
const { matchKey, normalize, tokenize, buildIndex } = profile.text;

/**
 * Verb entries that are legitimately not infinitives: high-frequency finite
 * forms (است، باشد) and a modal (باید) kept as standalone headwords because
 * learners meet them constantly and look them up by themselves.
 */
const VERB_POS_EXEMPT = new Set(["lx-0010", "lx-0287", "lx-0290"]);
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
      if (e.targetNormalized !== normalize(e.targetNormalized)) {
        fail(`lexicon ${e.id}: targetNormalized not normalized (${e.targetNormalized})`);
      }
      const key = matchKey(e.targetNormalized);
      const clash = keys.get(key);
      if (clash) fail(`lexicon: ${e.id} and ${clash} share match key "${key}"`);
      keys.set(key, e.id);
      // The schema allows transliteration to be absent (a Latin-script
      // language has none). Whether it must be present is a property of the
      // language, so it is enforced here rather than in the schema.
      if (profile.capabilities.transliteration) {
        if (!e.translit) fail(`lexicon ${e.id}: missing translit`);
        if (!e.exampleTranslit) fail(`lexicon ${e.id}: missing exampleTranslit`);
      }
      if (e.presentStem !== undefined) {
        if (!/^[؀-ۿ‌]+$/.test(e.presentStem)) {
          fail(`lexicon ${e.id}: presentStem not Persian script (${e.presentStem})`);
        }
        if (e.presentStem !== normalize(e.presentStem)) {
          fail(`lexicon ${e.id}: presentStem not normalized (${e.presentStem})`);
        }
      }
      // A Dari verb entry is an infinitive: it ends in دن/تن, or is a compound
      // whose light verb does. Without this, a whole freqRank block of adverbs
      // once shipped tagged pos="verb" - which colours them as verbs in the
      // reader and strips context off their SRS cards. The exemptions are
      // genuine high-frequency finite forms kept as standalone entries.
      if (lang === "prs" && e.pos === "verb" && !VERB_POS_EXEMPT.has(e.id)) {
        const head = e.targetNormalized.split(" ").at(-1)!;
        if (!/(دن|تن)$/.test(head)) {
          fail(`lexicon ${e.id}: pos="verb" but "${e.targetNormalized}" is not an infinitive`);
        }
      }
      // Compounds must be space-separated so lexicon-index can spot the light
      // verb; a ZWNJ standing in for the space (استخدام‌کردن) silently defeats
      // that. A ZWNJ *inside* a part is fine (هیجان‌زده شدن), so only flag
      // entries that have no space at all.
      if (
        lang === "prs" &&
        e.pos === "verb" &&
        !e.targetNormalized.includes(" ") &&
        e.targetNormalized.includes(ZWNJ) &&
        /(دن|تن)$/.test(e.targetNormalized)
      ) {
        fail(`lexicon ${e.id}: compound verb joined with ZWNJ, use a space (${e.targetNormalized})`);
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
if (!profile.capabilities.scriptCourse) {
  console.log("• alphabet course skipped (language has no script course)");
} else if (existsSync(coursePath)) {
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
  const index = lexicon ? buildIndex(lexicon.entries) : null;

  // ids must be globally unique across every level file.
  const blockIds = new Set<string>();
  const lessonIds = new Set<string>();
  const exerciseIds = new Set<string>();

  /**
   * Mid-sentence capitalised words in a Latin-script language are proper nouns
   * (Barcelona, Marta), and a lexicon should not carry them - a "Barcelona"
   * SRS card glossed "Barcelona" teaches nothing. Sentence-initial words are
   * capitalised for position, not because they are names, so those are still
   * checked. A script without letter case (Perso-Arabic) is unaffected: no
   * token ever differs from its lowercase form.
   */
  function properNouns(text: string): Set<string> {
    const names = new Set<string>();
    // Each sentence's first word is capitalised by convention; skip it.
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      const words = sentence.trim().split(/\s+/);
      // The first word is capitalised by position, but it may be a clitic
      // glued to a name ("L'Anna"), in which case the name still counts.
      const first = words[0]?.split("'").slice(1).join("'");
      for (const w of [...(first ? [first] : []), ...words.slice(1)]) {
        const bare = w.replace(/^[^\p{L}]+|[^\p{L}]+$/gu, "");
        if (bare && bare[0] !== bare[0].toLowerCase()) names.add(bare.toLowerCase());
      }
    }
    return names;
  }

  function checkVocab(where: string, target: string, warn: () => void) {
    if (!index) return;
    const names = properNouns(target);
    for (const token of tokenize(target)) {
      if (token === "___") continue;
      if (names.has(token.toLowerCase())) continue;
      if (index.resolve(token)) continue;
      warn();
      console.warn(`⚠ grammar ${where}: "${token}" not in lexicon`);
    }
  }

  function checkNormalized(where: string, target: string) {
    if (target !== normalize(target)) fail(`grammar ${where}: Dari not normalized ("${target}")`);
  }

  function checkExercise(where: string, ex: GrammarExercise, warn: () => void) {
    switch (ex.type) {
      case "fillBlank": {
        checkNormalized(where, ex.target);
        checkNormalized(`${where} answer`, ex.answer.target);
        const answerKey = normalize(ex.answer.target);
        for (const d of ex.distractors) {
          checkNormalized(`${where} distractor`, d.target);
          if (normalize(d.target) === answerKey) fail(`${where}: distractor equals answer ("${d.target}")`);
        }
        checkVocab(where, ex.target.replace("___", ex.answer.target), warn);
        break;
      }
      case "buildSentence": {
        const wordKeys = new Set(ex.words.map((w) => normalize(w.target)));
        for (const w of [...ex.words, ...ex.extraWords]) checkNormalized(where, w.target);
        for (const x of ex.extraWords) {
          if (wordKeys.has(normalize(x.target))) fail(`${where}: extraWord duplicates a sentence word ("${x.target}")`);
        }
        // Every alternate ordering must be a permutation of the sentence words.
        const sortedWords = ex.words.map((w) => normalize(w.target)).sort();
        for (const order of ex.altOrders) {
          const sortedOrder = order.map((d) => normalize(d)).sort();
          const isPermutation =
            sortedOrder.length === sortedWords.length &&
            sortedOrder.every((d, i) => d === sortedWords[i]);
          if (!isPermutation) fail(`${where}: altOrder is not a permutation of words ("${order.join(" ")}")`);
        }
        checkVocab(where, ex.words.map((w) => w.target).join(" "), warn);
        break;
      }
      case "chooseTranslation": {
        checkNormalized(where, ex.target);
        if (ex.direction === "toEn" && ex.distractorsEn.length < 2) {
          fail(`${where}: toEn needs at least 2 distractorsEn`);
        }
        if (ex.direction === "toTarget" && ex.distractorsTarget.length < 2) {
          fail(`${where}: toTarget needs at least 2 distractorsTarget`);
        }
        if (ex.distractorsEn.includes(ex.en)) fail(`${where}: distractorsEn contains the answer`);
        const targetKey = normalize(ex.target);
        for (const d of ex.distractorsTarget) {
          checkNormalized(`${where} distractor`, d.target);
          if (normalize(d.target) === targetKey) fail(`${where}: distractorsTarget contains the answer`);
        }
        checkVocab(where, ex.target, warn);
        break;
      }
      case "matchPairs": {
        const targetSeen = new Set<string>();
        const enSeen = new Set<string>();
        for (const p of ex.pairs) {
          checkNormalized(where, p.target);
          const dk = normalize(p.target);
          if (targetSeen.has(dk)) fail(`${where}: duplicate pair Dari "${p.target}"`);
          if (enSeen.has(p.en)) fail(`${where}: duplicate pair English "${p.en}"`);
          targetSeen.add(dk);
          enSeen.add(p.en);
          checkVocab(where, p.target, warn);
        }
        break;
      }
      case "spotError": {
        checkNormalized(where, ex.target);
        checkNormalized(`${where} correction`, ex.correction.target);
        const tokens = tokenize(ex.target).map((t) => normalize(t));
        if (!tokens.includes(normalize(ex.errorWord.target))) {
          fail(`${where}: errorWord "${ex.errorWord.target}" is not a token of the sentence`);
        }
        if (normalize(ex.errorWord.target) === normalize(ex.correction.target)) {
          fail(`${where}: correction equals errorWord`);
        }
        // Vocab-check the corrected sentence, not the (deliberately wrong) one.
        const corrected = ex.target.replace(ex.errorWord.target, ex.correction.target);
        checkVocab(where, corrected, warn);
        break;
      }
    }
  }

  // All of a language's grammar courses live in one barrel, because languages
  // ship different numbers of CEFR levels.
  const grammarPath = join(root, "grammar", "all.json");
  const grammarParsed = existsSync(grammarPath)
    ? grammarCoursesFileSchema.safeParse(loadJson(grammarPath))
    : null;
  if (!grammarParsed) fail("grammar/all.json missing");
  else if (!grammarParsed.success) {
    fail(
      `grammar/all.json: ${grammarParsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }

  for (const course of grammarParsed?.success ? grammarParsed.data.courses : []) {
    const level = course.level.toLowerCase();
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
            checkNormalized(`${lesson.id}/${slide.id}`, exm.target);
            if (exm.highlight && !exm.target.includes(exm.highlight)) {
              fail(`grammar ${lesson.id}/${slide.id}: highlight "${exm.highlight}" not in "${exm.target}"`);
            }
            checkVocab(`${lesson.id}/${slide.id}`, exm.target, warn);
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
