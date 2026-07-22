import { lexiconIndex } from "../content/load";
import { matchKey, normalizeDari, tokenizeDari } from "./normalize";

export interface HighlightSegment {
  text: string;
  hit: boolean;
}

/**
 * Split a context sentence into segments, marking the ones that belong to the
 * given lexeme — including conjugated/suffixed surface forms (خوبم → خوب),
 * resolved through the same lexicon index the reader uses for tap-to-lookup.
 * Returns null when no part of the sentence can be attributed to the lexeme,
 * so callers can fall back to showing the word in isolation.
 */
export function segmentForHighlight(sentence: string, lexemeId: string): HighlightSegment[] | null {
  const normalized = normalizeDari(sentence);
  const index = lexiconIndex();

  // Re-interleave word tokens with the punctuation/whitespace between them
  // (tokenizeDari drops separators), same cursor pattern as segmentSentence.
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  let anyHit = false;
  for (const token of tokenizeDari(normalized)) {
    const at = normalized.indexOf(token, cursor);
    if (at === -1) continue;
    if (at > cursor) segments.push({ text: normalized.slice(cursor, at), hit: false });
    const hit = index.resolve(token)?.id === lexemeId;
    anyHit = anyHit || hit;
    segments.push({ text: token, hit });
    cursor = at + token.length;
  }
  if (cursor < normalized.length) segments.push({ text: normalized.slice(cursor), hit: false });

  if (anyHit) return segments;

  // Multiword fallback (phrases, compound verbs like کار کردن): highlight the
  // headword's span if it occurs verbatim in the sentence.
  const entry = index.byId.get(lexemeId);
  if (entry) {
    const key = matchKey(normalized);
    const headKey = matchKey(entry.dariNormalized);
    // matchKey only strips/folds codepoints 1:1 for the text we generate, so
    // key offsets line up with `normalized` in practice; guard just in case.
    const at = key.indexOf(headKey);
    if (at !== -1 && key.length === normalized.length) {
      return [
        { text: normalized.slice(0, at), hit: false },
        { text: normalized.slice(at, at + headKey.length), hit: true },
        { text: normalized.slice(at + headKey.length), hit: false },
      ].filter((s) => s.text.length > 0);
    }
  }

  return null;
}
