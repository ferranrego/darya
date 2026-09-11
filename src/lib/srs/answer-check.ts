/**
 * Grading a Dari word a learner wrote, with no model call.
 *
 * Every flashcard in this app has been recognition: show the Dari, ask "do you
 * remember this?", reveal the English, press Forgot or Got it. Two things
 * follow. The learner grades themselves, and everyone is generous with
 * themselves when the answer is already on screen. And recognising a word is a
 * different skill from producing one - the app measured the easy one and
 * called the result "known". There has been no point anywhere in Darya where a
 * learner writes a Dari word.
 *
 * This is what makes the other direction possible for free. The repo already
 * contains a complete Dari word-form engine: `lexicon-index.ts` expands every
 * verb paradigm and every inflected surface and resolves any of them back to
 * the entry that owns it. Grading a typed answer is that resolution, run
 * backwards - so it costs nothing, and it works for all 6,466 entries rather
 * than for whichever words somebody wrote answers for.
 *
 * The failure to avoid is accepting a form that belongs to a *different* word:
 * marking `کار` right for `کردن` would teach a wrong answer as correct, and
 * would do it silently. Resolution decides that, never string similarity.
 */
import type { LexiconEntry } from "../content/schema";
import type { LexiconIndex } from "../lang/types";
import { matchKey, normalizeDari } from "../lang/prs/normalize";

/**
 * What the learner produced.
 *
 * `wrong-form` is deliberately not a failure. Reaching for the right word and
 * inflecting it wrongly is a different mistake from not knowing the word, it
 * is the more advanced of the two, and it is the one a teacher corrects rather
 * than re-teaches. Collapsing it into "wrong" throws away the distinction the
 * mistake record exists to keep.
 */
export type AnswerVerdict = "correct" | "wrong-form" | "wrong";

export interface AnswerCheck {
  verdict: AnswerVerdict;
  /** Which script they answered in, for the fading rule and for measurement. */
  script: "target" | "latin" | "unknown";
  /** The form they actually produced, when it was a real form of something. */
  matched?: string;
  /** The entry their answer landed on, when it landed on the wrong one. */
  resolvedTo?: LexiconEntry;
}

/**
 * Fold a Latin answer to a comparable key.
 *
 * Macrons come off, because nobody types `khāna` on a phone keyboard and
 * refusing `khana` would fail honest learners on the app's own notation rather
 * than on their Dari.
 *
 * What does NOT come off is the vowel quality itself. `ō` folds to `o`, so
 * `dōst` becomes `dost` - and a learner typing `dust` still does not match.
 * That is intentional: the Iranian-vs-Afghan vowel is the single defect this
 * project cares most about (PEDAGOGY.md §9), and silently accepting `dust` for
 * `dōst` would teach the flattening the whole lexicon was repaired to remove.
 */
export function foldLatin(input: string): string {
  return input
    .normalize("NFD")
    // Combining macron only (U+0304). Other marks are left alone so that a
    // notation which later distinguishes them is not pre-emptively destroyed.
    .replace(/̄/g, "")
    .normalize("NFC")
    .toLowerCase()
    // The apostrophe in `ra'īs` is a consonant a learner cannot be expected to
    // type, and hyphens mark the ezafe, which is grammar rather than spelling.
    .replace(/['’\-\s]+/g, "")
    .trim();
}

/** True when the answer is written in the Afghan script rather than Latin. */
function isTargetScript(input: string): boolean {
  return /[؀-ۿ]/u.test(input);
}

/** Every Latin spelling that counts as this entry, folded. */
function latinFormsOf(entry: LexiconEntry): Set<string> {
  const out = new Set<string>();
  if (entry.translit) out.add(foldLatin(entry.translit));
  return out;
}

/**
 * The spellings that count as the headword itself.
 *
 * Deliberately NOT `entry.variants`. Those are "surface variants that should
 * resolve to this lexeme when tokenizing" - inflected forms, not alternative
 * spellings: رفتن carries می‌روم، رفتم، برو and eleven more. A learner asked to
 * write "to go" who produces "I go" has the right word in the wrong form,
 * which is a correction rather than a pass, and folding those into `correct`
 * would quietly make the production card impossible to fail on grammar.
 */
function headwordFormsOf(entry: LexiconEntry): Set<string> {
  return new Set<string>([headwordKey(entry.target), headwordKey(entry.targetNormalized)]);
}

/**
 * Comparison key for a headword: the match key, minus ZWNJ and spaces.
 *
 * 713 of the 6,466 headwords contain a zero-width non-joiner, which is
 * invisible on screen, absent from most phone keyboards, and impossible to
 * produce at all from letter tiles. Failing a learner on a character they
 * cannot see or type would be failing them on the app's own encoding.
 *
 * Checked against the whole lexicon before doing it: folding ZWNJ and spaces
 * merges exactly 11 pairs of headword spellings, and every one of them is the
 * same word written two ways (بر خلاف / برخلاف, روان‌شناس / روانشناس). No two
 * distinct words collide, which is the only thing that would make this unsafe.
 */
function headwordKey(input: string): string {
  return matchKey(input).replace(/[\u200c\s]+/g, "");
}

/**
 * Grade one produced answer against the word it was asked about.
 *
 * `index` is the app's own lexicon index - the same one the reader uses to
 * decide which entry a tapped word is - so "is this a form of that word" and
 * "which word is this a form of" have exactly one answer in the app, rather
 * than one here and a different one in the reader.
 */
export function checkAnswer(
  input: string,
  entry: LexiconEntry,
  index: LexiconIndex,
): AnswerCheck {
  const trimmed = input.trim();
  if (trimmed.length === 0) return { verdict: "wrong", script: "unknown" };

  const script = isTargetScript(trimmed) ? "target" : "latin";

  if (script === "latin") {
    const folded = foldLatin(trimmed);
    if (folded.length === 0) return { verdict: "wrong", script };
    if (latinFormsOf(entry).has(folded)) {
      return { verdict: "correct", script, matched: trimmed };
    }
    // A Latin answer cannot be resolved through the index - that index is
    // built on Dari script - so there is no "wrong form" verdict available
    // here, and claiming one would be a guess.
    return { verdict: "wrong", script };
  }

  const normalized = normalizeDari(trimmed);
  if (headwordFormsOf(entry).has(headwordKey(normalized))) {
    return { verdict: "correct", script, matched: normalized };
  }

  // Not the headword. Ask the engine what it *is* - the only safe way to tell
  // "an inflected form of this word" from "a different word entirely".
  const resolved = index.resolve(normalized);
  if (resolved?.id === entry.id) {
    return { verdict: "wrong-form", script, matched: normalized };
  }
  return {
    verdict: "wrong",
    script,
    matched: resolved ? normalized : undefined,
    resolvedTo: resolved ?? undefined,
  };
}
