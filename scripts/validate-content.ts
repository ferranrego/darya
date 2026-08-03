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
import { isRuledOut } from "../src/lib/content/teachability.ts";
import { verbSpec as caVerbSpec } from "../src/lib/lang/ca/lexicon-index.ts";
import { ZWNJ } from "../src/lib/lang/prs/normalize.ts";
import { PROFILES } from "../src/lib/lang/index.ts";
import { auditHomographs } from "./audit-homographs.ts";
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
    const glosses = new Map<string, string>();
    const glossClashes: string[] = [];
    const PLACEHOLDER = /\[|auto-fill/i;
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

      /**
       * Part of speech, in the one direction that can be decided mechanically.
       *
       * The gloss is written in English and an English gloss beginning "to "
       * is a verb; nothing else is glossed that way. The reverse is not
       * checkable and must not be attempted - `casa`/`casar`, `porta`/`portar`,
       * `dona`/`donar`, `veu`/`veure` are genuine homographs, so "this noun is
       * also a verb form" flags 92 Catalan entries of which almost none are
       * wrong. Judging those is the philologist's job; this only removes the
       * cases where no judgement is required.
       *
       * Worth having because the field was never decided for 290 entries - the
       * bulk pass that wrote them stamped `pos: "noun"` on all of them, which
       * is how `demanar`, `construir` and `evitar` shipped as nouns.
       *
       * "to" is also an English preposition, so a gloss may open with it
       * without naming an infinitive: `al` is "to the" and `li` is "to him".
       * Those are excluded by what follows the "to", not by an id list, so a
       * new entry glossed that way needs no maintenance here.
       */
      const TO_NOT_INFINITIVE = /^to\s+(the|a|an|him|her|it|them|us|me|you|my|your|his|their|our|this|that|these|those|which|whom|where|one|both|each)\b/i;
      if (
        /^to\s+\p{L}/iu.test(e.glossEn) &&
        !TO_NOT_INFINITIVE.test(e.glossEn) &&
        e.pos !== "verb" &&
        e.pos !== "phrase"
      ) {
        fail(`lexicon ${e.id}: glossed "${e.glossEn}" but pos="${e.pos}" (a "to …" gloss is a verb)`);
      }

      /**
       * Entries sharing a gloss, reported rather than rejected.
       *
       * An SRS production card asks for the English and expects one answer, so
       * `tia` and `tieta` both glossed "aunt" is a card the learner cannot get
       * right - they answer `tia` and the `tieta` card marks them wrong.
       *
       * It is a warning because it is not a defect. 156 Catalan and 369 Dari
       * pairs collide, and nearly all are honest synonyms a language simply
       * has: two words for "this", "old", "but", "reason". Failing on those
       * would block every run for a condition nobody intends to fix. What the
       * count is good for is spotting when a *repair batch* introduces a new
       * collision, which is how it was found - so read the delta, not the
       * total.
       */
      if (!isRuledOut(e) && !PLACEHOLDER.test(e.glossEn)) {
        const g = e.glossEn.trim().toLowerCase();
        const clash = glosses.get(g);
        if (clash) glossClashes.push(`${e.id} and ${clash}: "${e.glossEn}"`);
        else glosses.set(g, e.id);
      }

      /**
       * A Catalan verb must be conjugable, or the reader can resolve none of
       * its forms. `endur` had to be given an irregular spec for exactly this
       * reason; without one it would have shipped as a verb whose every
       * inflection was invisible to the engine.
       */
      if (lang === "ca" && e.pos === "verb" && !caVerbSpec(e.targetNormalized)) {
        fail(`lexicon ${e.id}: pos="verb" but "${e.targetNormalized}" has no conjugation spec`);
      }
    }
    console.log(
      `✓ lexicon.json (${lexicon.entries.length} entries` +
        (glossClashes.length ? `, ${glossClashes.length} shared glosses` : "") +
        `)`,
    );
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
        /**
         * The player renders one tappable chip per whitespace-separated word
         * (`exercise-player.tsx`), so solvability is decided by that split, not
         * by the language tokenizer. The two disagree: the tokenizer splits
         * `M'agrada` into `m'` + `agrada`, and checking against it accepted an
         * errorWord of "agrada" for a sentence whose only chip was "M'agrada" -
         * an exercise no tap could ever solve.
         */
        // ZWNJ is *inside* a Dari word (می‌رود), so it survives the strip; only
        // surrounding punctuation comes off.
        const chips = ex.target
          .split(/\s+/)
          .map((w) => normalize(w.replace(/^[^\p{L}]+|[^\p{L}\u200c]+$/gu, "")));
        if (!chips.includes(normalize(ex.errorWord.target))) {
          fail(`${where}: errorWord "${ex.errorWord.target}" is not one of the tappable words`);
        }
        if (normalize(ex.errorWord.target) === normalize(ex.correction.target)) {
          fail(`${where}: correction equals errorWord`);
        }
        // Vocab-check the corrected sentence, not the (deliberately wrong) one.
        // Substitution only reconstructs it when the fix is a one-token swap,
        // so prefer the authored version whenever there is one.
        const corrected =
          ex.correctedTarget ?? ex.target.replace(ex.errorWord.target, ex.correction.target);
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
const seedIndex = lexicon ? buildIndex(lexicon.entries) : null;
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
        if (!t.lexemeId) continue;
        if (!lexemeIds.has(t.lexemeId)) {
          fail(`${f}: token "${t.surface}" references missing lexeme ${t.lexemeId}`);
          continue;
        }
        /**
         * The id must be the lexeme the *surface* resolves to, not merely some
         * lexeme that exists.
         *
         * `lexemeId` is a denormalisation of `resolve(surface)`, and it drifts:
         * renumbering the lexicon once left all 52 tokens in these files
         * pointing at unrelated words, and every check here passed because the
         * ids were all still valid. The reader prefers the stored id over
         * resolving, so a learner tapping "casa" saw the entry for "els" and
         * got that word written into their review deck.
         */
        const resolved = seedIndex?.resolve(t.surface);
        if (resolved && resolved.id !== t.lexemeId) {
          fail(
            `${f}: token "${t.surface}" is linked to ${t.lexemeId} but resolves to ` +
              `${resolved.id} ("${resolved.targetNormalized}")`,
          );
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

// --- Homographs --------------------------------------------------------------
//
// A generated form (a verb's conjugation, a noun's plural/feminine) can spell
// identically to a *different* entry's authored headword - resolve() always
// prefers the headword, silently, so the check above (stored id agrees with
// resolve()) passes even when resolve() picked the wrong word: cuina (kitchen)
// shadowed cuinar's "cuina" (cooks) this way for months. See
// scripts/audit-homographs.ts for the full incident and the reviewed-allowlist
// design (content/<lang>/lexicon/homograph-review.json).
if (lexicon) {
  const { ambiguities, usages } = auditHomographs(lang, root, lexicon.entries, matchKey);
  for (const u of usages) {
    if (u.ok) continue;
    if (!u.review) {
      fail(
        `${u.file}: "${u.surface}" in "${u.sentence}" is bound to ${u.storedLexemeId}, ambiguous with ` +
          `${u.ambiguity.generator.id} ${u.ambiguity.generator.target} [${u.ambiguity.generator.pos}] - ` +
          `no reviewed decision in content/${lang}/lexicon/homograph-review.json`,
      );
      continue;
    }
    fail(
      `${u.file}: "${u.surface}" in "${u.sentence}" is bound to ${u.storedLexemeId}, but the reviewed decision ` +
        `in homograph-review.json says the correct lexeme is ${u.review.correctLexemeId} (${u.review.reason})`,
    );
  }
  console.log(`✓ homographs (${ambiguities.size} ambiguous surface(s), ${usages.length} used in seed texts)`);
}

if (errors > 0) {
  console.error(`\n${errors} content error(s)`);
  process.exit(1);
}
console.log("\nAll content valid.");
