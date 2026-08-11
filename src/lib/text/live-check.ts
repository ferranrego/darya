import { isKnownToken } from "../ai/vocab-check";
import { profile } from "../lang";
import { matchKey, tokenize } from "./index";

/**
 * What can be said about a learner's draft without asking a model anything.
 *
 * This exists because the useful half of "check my grammar" needs no
 * intelligence at all. Two kinds of mistake dominate beginner writing and both
 * are decidable from a table:
 *
 *   - a word that is not a word. `isKnownToken` already resolves every real
 *     form including inflections, and it is the same resolver the reader uses
 *     for tap-to-lookup, so anything it rejects is something the app could not
 *     have explained anyway.
 *   - a word from the language next door. Each profile carries the
 *     substitutions its learners actually reach for, with an authored English
 *     explanation - `مدرسه` for `مکتب`, `hi han` for `hi ha`.
 *
 * Both run in the browser on every keystroke, cost nothing, and answer
 * instantly. What is left over - agreement, word order, tense - is what the
 * model is for, and that happens once per turn inside the reply it was already
 * being paid for. Nothing here ever calls a provider.
 */

export interface LiveHint {
  /** The learner's text that is being flagged, as they wrote it. */
  found: string;
  /** What to write instead, or null when we only know it is wrong. */
  suggestion: string | null;
  /** One sentence of English. Authored, never generated. */
  whyEn: string;
  kind: "interference" | "unknown";
}

/**
 * Below this a draft is too short to judge. A learner mid-word is not making a
 * mistake yet, and flagging them for it is the fastest way to teach someone
 * that the red text means nothing.
 */
const MIN_TOKENS = 1;

/** Hints shown at once. More than a few reads as failure rather than help. */
const MAX_HINTS = 3;

function normalizedWords(text: string): string[] {
  return tokenize(text).map((t) => matchKey(t));
}

/**
 * Interference rules whose phrase appears in the draft.
 *
 * Matched over the normalized token sequence rather than the raw string, so a
 * rule cannot fire inside a longer word - `lo` must not flag `los` or, in a
 * Latin-script language, the middle of `color`.
 */
function interferenceHints(words: string[]): LiveHint[] {
  const hints: LiveHint[] = [];

  for (const rule of profile.prompts.interferenceRules) {
    const candidates = [rule.wrong, ...(rule.alsoMatch ?? [])];
    const hit = candidates.find((phrase) => {
      const needle = normalizedWords(phrase);
      if (needle.length === 0) return false;
      return words.some((_, i) => needle.every((w, j) => words[i + j] === w));
    });

    if (hit) {
      hints.push({
        found: hit,
        suggestion: rule.right,
        whyEn: rule.whyEn,
        kind: "interference",
      });
    }
  }

  return hints;
}

/**
 * Tokens the lexicon and morphology cannot account for.
 *
 * Only meaningful for a build whose script makes target-language text
 * identifiable. It is deliberately silent about *why* a word is unknown: it may
 * be a typo, a Spanish word, or a real word the lexicon has not got yet, and
 * claiming to know which would be wrong about a third of the time.
 */
function unknownHints(text: string, words: string[]): LiveHint[] {
  const raw = tokenize(text);
  const seen = new Set<string>();
  const hints: LiveHint[] = [];

  raw.forEach((token, i) => {
    const key = words[i];
    if (!key || seen.has(key)) return;
    if (isKnownToken(token)) return;
    seen.add(key);
    hints.push({
      found: token,
      suggestion: null,
      whyEn: `Not a ${profile.name} word we recognise: check the spelling.`,
      kind: "unknown",
    });
  });

  return hints;
}

/**
 * Check a draft. Pure, synchronous, and free.
 *
 * `looksLikeTarget` is the caller's job: on a Latin-script build every English
 * word the learner types would otherwise come back as unknown, which is noise,
 * not help.
 */
export function checkDraft(text: string): LiveHint[] {
  const words = normalizedWords(text);
  if (words.length < MIN_TOKENS) return [];

  // Interference first: it is the hint that carries a fix, and an Iranian
  // spelling is also an unknown token, so the specific one has to win.
  const interference = interferenceHints(words);
  const flagged = new Set(
    interference.flatMap((h) => normalizedWords(h.found)),
  );

  const unknown = unknownHints(text, words).filter((h) => !flagged.has(matchKey(h.found)));

  return [...interference, ...unknown].slice(0, MAX_HINTS);
}
