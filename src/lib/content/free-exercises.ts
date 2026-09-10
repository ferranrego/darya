/**
 * Practice exercises built from text the app already owns, with no model call.
 *
 * Every token in a seed text is linked to a lexeme by `build-seed-texts.ts`,
 * which fails the build on a word it cannot resolve. That is the strongest
 * guarantee in the repo, and it means an exercise cut out of one of these
 * sentences is in-vocabulary by construction - no `assertKnownVocab` pass, no
 * retry loop, no provider call. The generator's own output has to be checked
 * for exactly the properties these have for free.
 *
 * Two reasons this is worth having beyond the cost:
 *
 *  - Five free-tier provider quotas are shared by every learner of the
 *    deployment, so one active learner can exhaust a day for everybody. A
 *    practice session that costs nothing is a practice session that cannot do
 *    that.
 *  - PEDAGOGY §7 wants 6-12 encounters with a word and the beginner corpus
 *    delivers one for 51% of them. Meeting a sentence again in a different
 *    shape is re-exposure, which is the thing actually missing - not novelty.
 *
 * This became possible only once every seed sentence had a transliteration:
 * `sentenceTranslit` is a required field on both exercise types, so while 68%
 * of beginner sentences had none, none of them could be turned into one.
 */
import type { ExerciseData } from "../ai/schemas.ts";
import type { LexiconEntry, TextDocument } from "./schema.ts";
import { shuffle } from "./word-selection.ts";

/** Shortest sentence worth unscrambling; below this there is nothing to order. */
const MIN_UNSCRAMBLE_WORDS = 3;
/** Longest, above which reordering is a memory test rather than a grammar one. */
const MAX_UNSCRAMBLE_WORDS = 7;
/** A cloze needs three wrong options to choose between. */
const DISTRACTOR_COUNT = 3;
/**
 * Share of a session reserved for word-order practice.
 *
 * Without a reserve there is none: a cloze can be cut from almost every
 * sentence, one exercise per sentence is the rule, and so the cloze pass
 * consumes the whole corpus before the unscramble pass sees it - measured at
 * 400 clozes and 0 unscrambles across the seed texts. That is how `unscramble`
 * stayed dead for so long while being fully built. A third is enough to make
 * the SOV word order something a learner practises rather than only reads.
 */
const UNSCRAMBLE_SHARE = 1 / 3;

export interface FreeExerciseInput {
  /** Seed texts to cut from, usually the ones at the learner's level. */
  docs: readonly TextDocument[];
  /** Lexeme ids worth practising: what they got wrong, then what they are learning. */
  targetLexemeIds: readonly string[];
  /** Everything the learner knows, used to draw plausible wrong answers. */
  known: readonly LexiconEntry[];
  /** How many to build. */
  count: number;
  /** Deterministic ordering, so a session can be reproduced in a test. */
  rand: () => number;
}

/** A built exercise, with the lexeme it exists to practise. */
export interface FreeExercise {
  data: ExerciseData;
  lexemeId: string;
  /** Which text it came from, so the same sentence is not used twice in a session. */
  textId: string;
}

/**
 * Wrong answers a learner could believe.
 *
 * Drawn from words they already know and from the same part of speech, because
 * a distractor of a different class is not a distractor - "the boy ___ bread"
 * with `khāna` among the options tests nothing. Falls back to any known word
 * when the part of speech is too thin to fill three slots, since an exercise
 * with weak distractors still beats no exercise.
 */
function distractorsFor(
  answer: LexiconEntry,
  known: readonly LexiconEntry[],
  rand: () => number,
): string[] {
  const samePos = known.filter((e) => e.pos === answer.pos && e.id !== answer.id);
  const pool = samePos.length >= DISTRACTOR_COUNT ? samePos : known.filter((e) => e.id !== answer.id);
  return shuffle(pool, rand)
    .slice(0, DISTRACTOR_COUNT)
    .map((e) => e.target);
}

export function buildFreeExercises(input: FreeExerciseInput): FreeExercise[] {
  const { docs, targetLexemeIds, known, count, rand } = input;
  // Reserve first, fill later: whichever pass runs out gives its share back in
  // the final cloze pass, so a session is never short because of the split.
  const unscrambleQuota = Math.max(1, Math.round(count * UNSCRAMBLE_SHARE));
  const clozeQuota = count - unscrambleQuota;

  const wanted = new Set(targetLexemeIds);
  const byId = new Map(known.map((e) => [e.id, e]));
  const out: FreeExercise[] = [];
  // Keyed by the sentence itself, not by where it sits. Three sentences appear
  // in two beginner texts each - which is welcome re-exposure across a course,
  // and confusing twice in one five-item session.
  const usedSentences = new Set<string>();

  /**
   * Blank the target word out of a sentence that contains it.
   *
   * Walks the targets in the order given - callers put unresolved mistakes
   * first - so the exercises a learner sees are about what they got wrong.
   * Runs twice: once up to the cloze quota, and once more at the end to take
   * back whatever the word-order pass could not use.
   */
  function clozePass(limit: number): void {
    for (const lexemeId of targetLexemeIds) {
      if (out.length >= limit) break;
      const answer = byId.get(lexemeId);
      if (!answer) continue;

      for (const doc of docs) {
        if (out.length >= limit) break;
        for (const sentence of doc.sentences) {
          const key = sentence.target;
          if (usedSentences.has(key)) continue;
          if (!sentence.translit) continue; // both exercise types require it
          const hit = sentence.tokens.find((t) => t.lexemeId === lexemeId);
          if (!hit) continue;
          // Every other word must be one the learner knows, or the exercise
          // quietly tests vocabulary it never taught.
          if (
            !sentence.tokens.every(
              (t) => !t.lexemeId || t.lexemeId === lexemeId || wanted.has(t.lexemeId) || byId.has(t.lexemeId),
            )
          ) {
            continue;
          }
          const distractors = distractorsFor(answer, known, rand);
          if (distractors.length < DISTRACTOR_COUNT) continue;

          usedSentences.add(key);
          out.push({
            lexemeId,
            textId: doc.id,
            data: {
              type: "cloze",
              sentenceTarget: sentence.target,
              sentenceTranslit: sentence.translit,
              sentenceEn: sentence.en,
              missingWord: hit.surface,
              missingTranslit: answer.translit ?? hit.surface,
              missingEn: answer.glossEn,
              distractors,
              lexemeId,
            },
          });
          break; // one exercise per target word per pass
        }
      }
    }
  }

  clozePass(clozeQuota);

  // Word-order practice over the sentences the cloze pass did not take, which
  // exercises the SOV rule every level's grammar rests on.
  for (const doc of docs) {
    if (out.length >= count) break;
    for (const sentence of doc.sentences) {
      if (out.length >= count) break;
      const key = sentence.target;
      if (usedSentences.has(key) || !sentence.translit) continue;
      const words = sentence.tokens.map((t) => t.surface);
      if (words.length < MIN_UNSCRAMBLE_WORDS || words.length > MAX_UNSCRAMBLE_WORDS) continue;
      const target = sentence.tokens.find((t) => t.lexemeId && wanted.has(t.lexemeId));
      if (!target?.lexemeId) continue;
      usedSentences.add(key);
      out.push({
        lexemeId: target.lexemeId,
        textId: doc.id,
        data: {
          type: "unscramble",
          sentenceTarget: sentence.target,
          sentenceTranslit: sentence.translit,
          sentenceEn: sentence.en,
          words: shuffle(words, rand),
        },
      });
    }
  }

  // Word-order sentences need 3-7 words and a target word, so they run out
  // first on a short corpus. Give the remainder back rather than returning a
  // session with fewer exercises than were asked for.
  clozePass(count);

  return out;
}
