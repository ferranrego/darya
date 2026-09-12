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
  placementControlsFileSchema,
  textDocumentSchema,
  type AlphabetCourse,
  type GrammarExercise,
  type LexiconEntry,
  type LexiconFile,
  type LevelsFile,
  type TextDocument,
} from "../src/lib/content/schema.ts";

import { levelVocabulary } from "../src/lib/content/level-vocabulary.ts";
import { isRuledOut, isTeachable } from "../src/lib/content/teachability.ts";
import { checkShape } from "../src/lib/content/text-checks.ts";
import { isContentWord } from "../src/lib/content/word-selection.ts";
import { PROFILES } from "../src/lib/lang/index.ts";
import { bareEzafeAfterVowel, isFlattenedTranslit } from "../src/lib/lang/prs/translit-check.ts";
import { auditHomographs } from "./audit-homographs.ts";
import { contentRoot, targetLang } from "./content-path.ts";
import { insertionOrderSuffix } from "./freq-integrity.ts";

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
const { matchKey, normalize, tokenize, buildIndex, verbHeadwordProblem } = profile.text;

let errors = 0;

function fail(msg: string) {
  errors++;
  console.error(`✗ ${msg}`);
}

function loadJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8"));
}

/**
 * Dari transliteration rules, applied to the lexicon and to seed texts alike.
 *
 * PEDAGOGY §9 calls Iranian forms taught as Dari the defect the product cares
 * most about, and since the app ships no audio, the Latin line *is* the
 * pronunciation a learner internalises. Getting it wrong does not look like a
 * bug; it looks like a word, and the learner memorises an Iranian accent.
 *
 * The two named-word rules came first and are kept. The third is the one that
 * generalises: a batch of drafted texts arrived with every long ā and every
 * majhul ē/ō flattened out - `emroz` for `emrōz`, `khob` for `khōb`, `seb`
 * for `sēb`, `merawem` for `mērawēm` - and not one of them contained a word
 * from a blocklist. What they did have in common is that a whole sentence of
 * Dari went by without a single long vowel in it, which effectively cannot
 * happen in real Kabuli transliteration. Measured before this shipped: it
 * flags 30 of those draft lines and none of the 127 transliterated sentences
 * already in the corpus. A rule that matches a list of words cannot catch a
 * whole language written the wrong way; this one can.
 */
function checkDariTranslit(
  text: string,
  subject: string,
  field: string,
  id?: string,
  script?: string,
) {
  if (/\bmi-/i.test(text)) {
    fail(`${subject}: ${field} present prefix must be mē-, not mi- (${text})`);
  }
  if (/\bshir\b/i.test(text)) {
    fail(`${subject}: ${field} must use majhul vowel ē (shēr, not shir) (${text})`);
  }
  if (/\bdust/i.test(text)) {
    fail(`${subject}: ${field} must use majhul vowel ō (dōst, not dust) (${text})`);
  }
  const bareEzafe = bareEzafeAfterVowel(text);
  if (bareEzafe) {
    fail(
      `${subject}: ${field} writes the ezafe as "${bareEzafe}" - after a vowel ` +
        `it is -ye, not a bare -e (${text})`,
    );
  }
  if (script && isFlattenedTranslit(text, script, id)) {
    fail(
      `${subject}: ${field} has no long or majhul vowel anywhere - ` +
        `Iranian-flattened transliteration (${text})`,
    );
  }
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
        if (lang === "prs") {
          if (e.translit) checkDariTranslit(e.translit, `lexicon ${e.id}`, "translit", e.id);
          if (e.exampleTranslit) {
            checkDariTranslit(
              e.exampleTranslit,
              `lexicon ${e.id}`,
              "exampleTranslit",
              e.id,
              e.exampleTarget,
            );
          }
        }
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
       * A verb headword the engine cannot resolve is worse than a missing one:
       * it renders, and every inflection of it is invisible. What disqualifies
       * one is language-specific, so the language answers - see
       * `verbHeadwordProblem` in LanguageText. This replaced three branches
       * here (two `lang === "prs"`, one `lang === "ca"`) that reached straight
       * into `lang/prs/normalize.ts` and `lang/ca/lexicon-index.ts`, which made
       * the shared content gate the one file that could not be shared.
       */
      if (e.pos === "verb") {
      
      
        const problem = verbHeadwordProblem(e.targetNormalized);
        if (problem) {
          fail(`lexicon ${e.id}: pos="verb" but "${e.targetNormalized}" ${problem}`);
        }
      }
    }

    /**
     * `freqRank` must be a frequency, not an arrival time.
     *
     * A batch of 121 Dari entries once shipped with `freqRank` tracking their
     * own lexeme id one-for-one - the authoring tool's "one past the current
     * maximum", stamped once and never revisited by `build-frequency.ts`. All
     * 121 sat in `freqBand` 10 despite being ordinary words (`نمک` salt, `میز`
     * table, `آشپزخانه` kitchen), so they could never enter a beginner text:
     * every selector in `word-selection.ts` sorts by `freqRank`. See
     * `scripts/freq-integrity.ts` for the detector and `build-frequency.ts`
     * for the repair. This is the check that stops it coming back with the
     * next batch of hand-added entries.
     */
    const unranked = insertionOrderSuffix(lexicon.entries);
    if (unranked.length > 0) {
      fail(
        `lexicon: ${unranked.length} entries were never independently frequency-ranked ` +
          `(freqRank tracks insertion order) - run 'node scripts/build-frequency.ts --lang ${lang} --apply'. ` +
          `First few: ${unranked.slice(0, 5).map((e) => `${e.id} ${e.target}`).join(", ")}`,
      );
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


// Every `grammarPoint` the course defines, for the seed-text tag check below.
// Read from the same barrel the course itself is validated from, so the two
// cannot drift into different ideas of which points exist.
const grammarPointIds = new Set<string>();
{
  const parsed = grammarCoursesFileSchema.safeParse(loadJson(join(root, "grammar", "all.json")));
  if (parsed.success) {
    for (const course of parsed.data.courses) {
      for (const block of course.blocks) {
        for (const lesson of block.lessons) grammarPointIds.add(lesson.grammarPoint);
      }
    }
  }
}

// --- Seed texts ------------------------------------------------------------
const seedDir = join(root, "texts", "seed");
const seedIndex = lexicon ? buildIndex(lexicon.entries) : null;
const levelsById = new Map((levels?.levels ?? []).map((l) => [l.id, l]));
const lexiconById = new Map((lexicon?.entries ?? []).map((e) => [e.id, e]));
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
    if (lang === "prs") {
      if (doc.titleTranslit) {
        checkDariTranslit(doc.titleTranslit, f, "titleTranslit", undefined, doc.titleTarget);
      }
      for (const s of doc.sentences) {
        if (s.translit) checkDariTranslit(s.translit, f, "translit", undefined, s.target);
      }
    }
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
        /**
         * A two-word compound verb is the one case where a token deliberately
         * does not resolve to its own id.
         *
         * `build-seed-texts.ts` links both halves of دوست داشتن to the
         * compound, because دوست on its own is the noun "friend" and a learner
         * tapping it in "I like this book" was told exactly that. The stored id
         * therefore differs from `resolve(surface)` on purpose - which is the
         * same shape as the drift this check exists to catch, so it has to be
         * told the difference. A link is accepted only when the stored lexeme
         * really is a two-word verb and this surface really is one of its two
         * words; anything else is still drift.
         */
        const linked = t.lexemeId ? lexiconById.get(t.lexemeId) : undefined;
        const compoundParts =
          linked?.pos === "verb" && linked.targetNormalized.includes(" ")
            ? linked.targetNormalized.split(" ")
            : null;
        const isCompoundHalf =
          compoundParts?.length === 2 &&
          compoundParts.some((part) => seedIndex?.resolve(part)?.id === resolved?.id);
        if (resolved && resolved.id !== t.lexemeId && !isCompoundHalf) {
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

    /**
     * The level spec was never checked against the texts.
     *
     * `levels.json` states `maxSentenceWords`, `sentenceRange` and `freqBands`
     * per level, and nothing read any of them for a seed text - `checkShape`
     * existed and was only ever applied to generated ones. So a batch of new
     * L1 texts could carry nine-word sentences and vocabulary five bands out
     * of range and pass green, which is exactly what happened: texts 001-037
     * obey the spec and a later batch did not, leaving L1 as two courses.
     *
     * `checkShape` is reused rather than reimplemented, so the rule a seed
     * text is held to and the rule a generated one is held to cannot drift.
     * Length fails the build; `text-checks.ts` says why - "a sentence past the
     * ceiling is not readable at the level, which is the entire point of the
     * ceiling". Sentence count and frequency band warn instead: both have
     * violations in content that shipped long ago, and turning those red would
     * only teach the next person to silence the check.
     */
    const spec = levelsById.get(doc.level);
    if (spec) {
      for (const defect of checkShape(doc, spec)) {
        if (defect.kind === "sentence-length") fail(`${f}: ${defect.message}`);
        else console.warn(`⚠ ${f}: ${defect.message}`);
      }
      const bands = new Set(spec.freqBands ?? []);
      const outOfBand = new Set<string>();
      for (const sentence of doc.sentences) {
        for (const token of sentence.tokens) {
          if (!token.lexemeId) continue;
          const entry = lexiconById.get(token.lexemeId);
          if (entry && bands.size > 0 && !bands.has(entry.freqBand)) {
            outOfBand.add(`${token.surface} (band ${entry.freqBand})`);
          }
        }
      }
      if (outOfBand.size > 0) {
        console.warn(
          `⚠ ${f}: ${outOfBand.size} word(s) outside ${doc.level}'s bands: ` +
            `${[...outOfBand].slice(0, 4).join(", ")}`,
        );
      }
    }

    /**
     * A comprehension question that cannot be answered is invisible.
     *
     * Every defect here renders perfectly: an `answerIndex` past the end of
     * the options marks every answer wrong, two identical options mark a right
     * answer wrong, and an `evidenceSentence` pointing at the wrong line shows
     * a learner a correction that does not correct anything. None of it throws,
     * and the learner concludes they misunderstood the text.
     */
    /**
     * A grammar tag that names no lesson silently links nothing.
     *
     * The whole value of tagging is "read something that uses what you just
     * learned", and a typo'd tag makes that query return an empty list rather
     * than an error - the text simply never surfaces, and nobody finds out.
     */
    for (const point of doc.grammarPoints) {
      if (!grammarPointIds.has(point)) {
        fail(`${f}: grammar point "${point}" names no lesson in the course`);
      }
    }

    doc.questions.forEach((q, qi) => {
      const where = `${f}: question ${qi + 1}`;
      if (q.answerIndex >= q.options.length) {
        fail(`${where}: answerIndex ${q.answerIndex} but only ${q.options.length} options`);
      }
      if (q.evidenceSentence >= doc.sentences.length) {
        fail(`${where}: evidenceSentence ${q.evidenceSentence} but only ${doc.sentences.length} sentences`);
      }
      const targets = new Set(q.options.map((o) => o.target));
      if (targets.size !== q.options.length) {
        fail(`${where}: two options say the same thing in Dari`);
      }
      const glosses = new Set(q.options.map((o) => o.en.trim().toLowerCase()));
      if (glosses.size !== q.options.length) {
        fail(`${where}: two options say the same thing in English`);
      }
      if (lang === "prs") {
        if (q.questionTranslit) {
          checkDariTranslit(q.questionTranslit, f, `question ${qi + 1} translit`, undefined, q.questionTarget);
        }
        // Pronunciation is the only guide to how Dari sounds in a text-only
        // app, so an option without one is an option a learner cannot say.
        q.options.forEach((o, oi) => {
          if (!o.translit) {
            fail(`${where}: option ${oi + 1} ("${o.target}") has no transliteration`);
            return;
          }
          checkDariTranslit(o.translit, f, `question ${qi + 1} option ${oi + 1}`, undefined, o.target);
        });
      }
    });
    ok++;
  }
  console.log(`✓ seed texts (${ok}/${files.length} valid)`);
} else {
  fail("content/texts/seed missing");
}

// --- Iranian vocabulary in the lexicon's own examples -------------------------
//
// `INTERFERENCE_RULES` lists the substitutions Dari learners actually reach
// for, and `live-check.ts` flags them in a learner's draft on every keystroke.
// Fourteen example sentences used those very words, so the app corrected a
// learner for typing دانشگاه while showing them دانشگاه on the card next to
// it. Now repaired to پوهنتون, مکتب, شفاخانه, سرک, موتر and طیاره.
//
// `MACHINE_SENSE` is the exception that has to be named. The rule about ماشین
// is about the *car* sense, where Dari says موتر; as "machine" the word is
// ordinary Dari, and the entries about machine learning, virtual machines and
// washing machines are right as they stand.
if (lexicon && lang === "prs") {
  const MACHINE_SENSE = new Set([
    "lx-6221", // ماشین itself, glossed "machine"
    "lx-0660", // ماشین کالی‌شویی - washing machine
    "lx-2058", // یادگیری ماشین - machine learning
    "lx-2826", // یادگیری عمیق, example mentions machine learning
    "lx-2827", // بینایی ماشین - machine vision
    "lx-3948", // ماشین الکتریکی - electric machine
    "lx-4590", // ماشین پروپاگاندا - propaganda machine
    "lx-4634", // ماشین مجازی - virtual machine
    "lx-4641", // ماشین بردار پشتیبان - support vector machine
    "lx-4651", // example mentions machine learning
    "lx-6420", // مدرسه itself: a madrassa is not a مکتب
    "lx-5342", // بیمارستان itself, an entry in its own right
  ]);
  for (const rule of profile.prompts.interferenceRules) {
    /**
     * Multi-word rules need a sequence match, not a token match.
     *
     * `خلیج فارس` is two words, and this compared single tokens against the
     * whole key - so a two-word rule could never fire, silently. The lexicon's
     * own خلیج entry carried the example "خلیج فارس منابع نفتی زیادی دارد" the
     * entire time, which is the exact string the generator is told never to
     * write. A check that cannot match one of its own rules is worse than no
     * check, because the passing build says the rule is satisfied.
     */
    const wanted = rule.wrong.split(/\s+/).map(matchKey);
    const matches = (tokens: string[]) =>
      tokens.some((_, i) => wanted.every((w, k) => matchKey(tokens[i + k] ?? "") === w));
    for (const e of lexicon.entries) {
      if (MACHINE_SENSE.has(e.id)) continue;
      if (!e.exampleTarget) continue;
      if (!matches(tokenize(e.exampleTarget))) continue;
      fail(
        `lexicon ${e.id}: example uses "${rule.wrong}" where Dari says ` +
          `"${rule.right}" - the same substitution live-check.ts flags in a ` +
          `learner's own writing ("${e.exampleTarget}")`,
      );
    }
  }
}

// --- The app must not teach a word it forbids --------------------------------
//
// The check above reads example sentences. Nothing read the *headword*, so the
// dictionary could carry مدرسه glossed "school" - at band 3, inside the
// beginner course and the placement grid - while `live-check.ts` corrected a
// learner on every keystroke for typing that same word. The app taught the
// word it forbids, and the two checks were one line apart.
//
// An entry is allowed to stand as the wrong side of an interference rule only
// when it has been ruled out of teaching (still resolvable for lookup, which
// imported Iranian text needs) or when its gloss is a genuinely different
// sense, named here with its reason.
if (lexicon && lang === "prs") {
  const HEADWORD_SENSE_OK = new Map([
    ["lx-6221", "ماشین glossed \"machine\" - ordinary Dari; only the *car* sense is Iranian"],
    ["lx-6420", "مدرسه glossed as a madrassa - a real Dari word for a religious school, which is not a مکتب"],
  ]);
  for (const rule of profile.prompts.interferenceRules) {
    const key = matchKey(rule.wrong);
    for (const e of lexicon.entries) {
      if (matchKey(e.targetNormalized) !== key) continue;
      if (HEADWORD_SENSE_OK.has(e.id) || isRuledOut(e)) continue;
      fail(
        `lexicon ${e.id}: the headword "${e.target}" (glossed "${e.glossEn}") is the ` +
          `Iranian form live-check.ts tells learners never to write - Dari says ` +
          `"${rule.right}". Rule it out with a "[not a headword: …]" gloss, or name ` +
          `it in HEADWORD_SENSE_OK if its gloss is a different sense.`,
      );
    }
  }
}

// --- Verbs that share a present stem -----------------------------------------
//
// Two verbs with the same present stem generate the *same* present-tense
// surfaces, so the resolver has to pick one and the other becomes unreachable.
// `audit-homographs.ts` does not see this: it compares lexicon surfaces, and
// these forms are generated rather than listed, so it reported "no unreviewed
// homograph usages" while three shipped beginner texts pointed at the wrong
// verb.
//
// Measured when this check was added, all three learner-facing:
//   L1 "او آب می‌کشد" (he draws water) linked می‌کشد to کشتن, "to kill" - so a
//   beginner tapping that word had "to kill" written into their review deck.
//   L2 "آنها گندم کشت می‌کنند" (they plant wheat) linked کشت to کشتن too, and
//   L2 "مرد دوباره در شهر می‌گردد" (the man strolls) linked می‌گردد to گردیدن,
//   "to become". All three sentences were rewritten to use a verb whose forms
//   belong to one lexeme only.
//
// Light-verb compounds are excluded: کار کردن and کردن share کن by
// construction, and resolving the verb token to کردن is correct there because
// the noun half is tokenized separately and carries the meaning. The check is
// therefore about *simplex* verbs whose meanings differ.
if (lexicon && lang === "prs") {
  const simplexByStem = new Map<string, LexiconEntry[]>();
  for (const e of lexicon.entries) {
    if (e.pos !== "verb" || !e.presentStem) continue;
    if (e.targetNormalized.includes(" ")) continue; // compound: noun + light verb
    const key = matchKey(e.presentStem);
    simplexByStem.set(key, [...(simplexByStem.get(key) ?? []), e]);
  }
  const lexemeById = new Map(lexicon.entries.map((e) => [e.id, e]));
  // A stem collision that a human has looked at and accepted is recorded in
  // the same file the surface-level homograph audit already uses, so there is
  // one place a reviewer signs off ambiguity rather than two.
  const reviewPath = join(root, "lexicon", "homograph-review.json");
  const stemReview = new Map<string, string>();
  if (existsSync(reviewPath)) {
    const file = loadJson(reviewPath) as {
      reviewed?: Array<{ surface: string; correctLexemeId: string }>;
    };
    for (const r of file.reviewed ?? []) {
      stemReview.set(`${r.surface}\u0000${r.correctLexemeId}`, r.correctLexemeId);
    }
  }
  const contested = new Map<string, LexiconEntry[]>();
  for (const [key, group] of simplexByStem) {
    // Same stem *and* the same gloss is a duplicate spelling, not a trap:
    // شنیدن/شنفتن both mean "to hear", so either resolution teaches the truth.
    const glosses = new Set(group.map((e) => e.glossEn.trim().toLowerCase()));
    if (group.length > 1 && glosses.size > 1) contested.set(key, group);
  }

  const seedFiles = existsSync(seedDir)
    ? readdirSync(seedDir).filter((f) => f.endsWith(".json"))
    : [];
  for (const f of seedFiles) {
    const parsed = textDocumentSchema.safeParse(loadJson(join(seedDir, f)));
    if (!parsed.success) continue;
    for (const s of parsed.data.sentences) {
      for (const t of s.tokens) {
        if (!t.lexemeId) continue;
        const entry = lexemeById.get(t.lexemeId);
        if (!entry || entry.pos !== "verb" || !entry.presentStem) continue;
        const group = contested.get(matchKey(entry.presentStem));
        if (!group) continue;
        const decided = stemReview.get(`${t.surface}\u0000${t.lexemeId}`);
        if (decided) continue;
        const others = group.filter((e) => e.id !== entry.id);
        fail(
          `${f}: "${t.surface}" resolves to ${entry.id} ${entry.targetNormalized} ` +
            `("${entry.glossEn}") but shares its present stem with ` +
            others.map((e) => `${e.targetNormalized} ("${e.glossEn}")`).join(", ") +
            ` - either rewrite "${s.target}" to use a verb whose forms belong to one ` +
            `lexeme, or record the decision in homograph-review.json`,
        );
      }
    }
  }
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
    /**
     * A compound-verb link has already been decided by context.
     *
     * `homograph-review.json` is keyed by surface, so one entry cannot say
     * "the compound when a light verb follows, the noun otherwise" - and بازی
     * is both, in the same corpus. `build-seed-texts.ts` now makes that call
     * per sentence by looking at the next token, which is strictly more
     * information than a surface-keyed file can hold. Where it has linked a
     * token to a two-word verb containing that surface, the reviewed decision
     * does not apply; everywhere else it still does.
     */
    const linked = lexiconById.get(u.storedLexemeId);
    if (
      linked?.pos === "verb" &&
      linked.targetNormalized.split(" ").length === 2 &&
      linked.targetNormalized
        .split(" ")
        .some((part) => matchKey(normalize(part)) === matchKey(normalize(u.surface)))
    ) {
      continue;
    }
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

// --- Level reachability ------------------------------------------------------
//
// `entryKnownWords` is a cumulative gate (PEDAGOGY §3): reaching level N+1 by
// the global promotion rule means having learned
// `entryKnownWords(N+1) - entryKnownWords(N)` words somewhere, and for a
// beginner learner the only place those can come from is level N's own
// teachable curriculum - nothing above it has been shown yet. This is a
// warning, not a failure: it is EXPECTED to fire for L1 today (481 ca / 429
// prs teachable content words against L2's 500-word gate) and the fix is
// separate follow-up content authoring, not something to block this build on.
// `nextLevelFor` (src/lib/content/promotion.ts) exists precisely because the
// global rule alone cannot reach L2 from L1 - this check makes that gap
// mechanically visible instead of only discoverable at runtime.
if (lexicon && levels) {
  let shortfalls = 0;
  for (let i = 0; i < levels.levels.length - 1; i++) {
    const level = levels.levels[i];
    const nextLevel = levels.levels[i + 1];
    const gap = nextLevel.entryKnownWords - level.entryKnownWords;
    const teachableCount = levelVocabulary(level, lexicon.entries, isTeachable).filter(
      isContentWord,
    ).length;
    if (teachableCount < gap) {
      shortfalls++;
      console.warn(
        `⚠ ${lang} ${level.id}: teachable curriculum (${teachableCount} words) is smaller than the ${gap}-word gap to ${nextLevel.id} - promotion by content alone cannot reach it`,
      );
    }
  }
  if (shortfalls === 0) {
    console.log(`✓ level reachability (every level's curriculum can reach the next)`);
  }
}

/**
 * Suffixes productive enough that root+suffix reads as a word.
 *
 * Not an exhaustive list of Dari morphology - only the endings that combine
 * freely enough to make an invented word legible. Longest first, so that -وک
 * is tried before -ک and the stem reported is the real one.
 */
const CONTROL_SUFFIXES = ["فشان", "ناک", "وش", "وک", "بان", "گر", "چه", "ک"];

/** True when two keys differ by at most one insertion, deletion or substitution. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let slack = 1;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
      continue;
    }
    if (slack === 0) return false;
    slack--;
    if (short.length === long.length) i++;
    j++;
  }
  return true;
}

// --- Set phrases -----------------------------------------------------------
//
// People do not speak in words, they speak in chunks: "چطور استید", "خیر است",
// "به امان خدا". The dictionary holds 39 of them against 6,466 entries - 0.6% -
// which is why a learner can know a thousand words and still not be able to
// open a conversation.
//
// A floor rather than a target: this cannot say how many phrases a course
// needs, only that the number must not go down. Phrases are the easiest thing
// to lose in a bulk lexicon edit, because a multi-word entry looks like a data
// error to anything scanning for headwords - and losing them is invisible,
// since every individual word survives.
const MIN_SET_PHRASES = 39;
if (lexicon) {
  const phrases = lexicon.entries.filter((e) => e.pos === "phrase");
  if (phrases.length < MIN_SET_PHRASES) {
    fail(
      `lexicon: ${phrases.length} set phrases, down from ${MIN_SET_PHRASES} - ` +
        `phrases are how people actually speak and are the easiest entries to lose ` +
        `in a bulk edit, because a multi-word headword looks like a data error`,
    );
  } else {
    console.log(`✓ set phrases (${phrases.length}, floor ${MIN_SET_PHRASES})`);
  }
}

// --- Beginner re-exposure --------------------------------------------------
//
// PEDAGOGY §7: a person needs to meet a word roughly 6 to 12 times before it
// sticks. Measured across the beginner course, 371 of its 430 content words
// are met fewer than six times and 221 exactly once - the finding that
// produced this whole refactor, and the one that cannot be fixed in code,
// because the fix is rewriting texts by hand.
//
// So this is a ratchet rather than a gate. The backlog file lists the words
// currently short; a word that is short and NOT listed is a new regression and
// fails the build, and the list itself may never grow. Authoring shrinks it,
// and it cannot quietly be undone in the meantime. Delete file and check when
// it empties.
const backlogPath = join(root, "texts", "re-exposure-backlog.json");
if (existsSync(backlogPath) && lexicon) {
  const backlog = loadJson(backlogPath) as {
    minEncounters: number;
    count: number;
    lexemeIds: string[];
  };
  const counts = new Map<string, number>();
  if (existsSync(seedDir)) {
    for (const f of readdirSync(seedDir).filter((x) => x.endsWith(".json"))) {
      const parsed = textDocumentSchema.safeParse(loadJson(join(seedDir, f)));
      if (!parsed.success) continue;
      if (parsed.data.level !== "L1" && parsed.data.level !== "L2") continue;
      for (const sentence of parsed.data.sentences) {
        for (const token of sentence.tokens) {
          if (token.lexemeId) counts.set(token.lexemeId, (counts.get(token.lexemeId) ?? 0) + 1);
        }
      }
    }
  }
  const listed = new Set(backlog.lexemeIds);
  const byId = new Map(lexicon.entries.map((e) => [e.id, e]));
  const regressions: string[] = [];
  let fixed = 0;
  for (const [id, n] of counts) {
    const entry = byId.get(id);
    // Function words repeat by their nature; the rule is about content words,
    // which is where "met once and never again" actually costs a learner.
    if (!entry || !isContentWord(entry)) continue;
    if (n < backlog.minEncounters) {
      if (!listed.has(id)) {
        regressions.push(`${entry.target} (${id}) appears ${n} time(s), needs ${backlog.minEncounters}`);
      }
    } else if (listed.has(id)) {
      fixed++;
    }
  }
  for (const r of regressions.slice(0, 10)) {
    fail(`beginner re-exposure: ${r} - and it is not in the backlog, so this is new`);
  }
  if (regressions.length > 10) {
    fail(`beginner re-exposure: ${regressions.length - 10} more not shown`);
  }
  if (backlog.lexemeIds.length > backlog.count) {
    fail(
      `re-exposure-backlog.json lists ${backlog.lexemeIds.length} words but records ${backlog.count} - ` +
        `the backlog may shrink, never grow`,
    );
  }
  if (regressions.length === 0) {
    console.log(
      `✓ beginner re-exposure (${backlog.lexemeIds.length - fixed} of ${backlog.count} still short, ` +
        `${fixed} fixed since the backlog was taken)`,
    );
  }
}

// --- Placement controls ----------------------------------------------------
//
// The invented words mixed into the sign-up grid. A control that turns out to
// be a real Dari word calls an honest learner a liar and lowers their placement
// for knowing their own language - which is worse than having no controls at
// all, and completely invisible.
//
// This is the half a machine can check: no control may resolve through the
// app's own word engine, which knows every headword, every listed variant and
// every generated verb form. It cannot prove a word is not Dari - the lexicon
// is 6,466 entries, not a dictionary of the language - so the list also goes
// to a philologist. Between them: nothing the app itself would recognise, and
// nothing a Dari speaker recognises.
const controlsPath = join(root, "lexicon", "placement-controls.json");
if (existsSync(controlsPath) && lexicon) {
  const parsed = placementControlsFileSchema.safeParse(loadJson(controlsPath));
  if (!parsed.success) {
    fail(`placement-controls.json: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  } else {
    const controlIndex = buildIndex(lexicon.entries);
    const seen = new Set<string>();
    const before = errors;
    // The end of the lexicon a learner would actually misread a control as.
    const commonHeadwords = lexicon.entries
      .filter((e) => e.freqBand <= 3)
      .map((e) => ({ entry: e, key: matchKey(e.targetNormalized) }));
    for (const c of parsed.data.controls) {
      const resolved = controlIndex.resolve(c.target);
      if (resolved) {
        fail(
          `placement-controls.json: "${c.target}" (${c.translit}) is not invented - it resolves ` +
            `to ${resolved.id} "${resolved.targetNormalized}" (${resolved.glossEn})`,
        );
      }
      const key = matchKey(c.target);
      if (seen.has(key)) fail(`placement-controls.json: "${c.target}" appears twice`);
      seen.add(key);

      if (lang === "prs") {
        /**
         * Two ways a control can be readable without being a dictionary word,
         * both found by a philologist in the first batch of forty and both
         * mechanisable - which is this repo's rule: a finding you only fix
         * comes back.
         *
         * First, a real root under a productive suffix. میزاک is میز "table"
         * plus the Kabuli diminutive -ک and reads unmistakably as "little
         * table"; سبزوک is سبز "green" the same way. A learner tapping one is
         * reading, not over-claiming, and gets penalised for it.
         */
        for (const suffix of CONTROL_SUFFIXES) {
          if (!c.target.endsWith(suffix)) continue;
          const stem = c.target.slice(0, -suffix.length);
          if (stem.length < 2) continue;
          const root = controlIndex.resolve(stem);
          if (root) {
            fail(
              `placement-controls.json: "${c.target}" is "${stem}" (${root.id} "${root.glossEn}") ` +
                `plus the productive suffix "${suffix}" - a learner can read it`,
            );
            break;
          }
        }

        /**
         * Second, one letter from a common word. فرگوش differs from خرگوش
         * "rabbit" only in where a dot sits, and مشتراخ from مشترک "shared"
         * only in a final letter that is near-identical in most naskh faces.
         * Checked against the common end of the lexicon only: a control need
         * not be distant from a rare word nobody would misread it as.
         */
        const near = commonHeadwords.find((h) => withinOneEdit(matchKey(c.target), h.key));
        if (near) {
          fail(
            `placement-controls.json: "${c.target}" is one letter from ` +
              `"${near.entry.targetNormalized}" (${near.entry.id}, "${near.entry.glossEn}")`,
          );
        }
      }
      if (lang === "prs") {
        // A control has to be pronounceable like everything else the app shows,
        // and one written in Iranian style would be a tell that it is a plant.
        checkDariTranslit(c.translit, "placement-controls.json", c.target, undefined, c.target);
      }
    }
    // Only claim success when nothing above failed: a tick printed underneath
    // its own errors is how a red gate gets read as green.
    if (errors === before) {
      console.log(`✓ placement controls (${parsed.data.controls.length} invented words, none resolve)`);
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} content error(s)`);
  process.exit(1);
}
console.log("\nAll content valid.");
