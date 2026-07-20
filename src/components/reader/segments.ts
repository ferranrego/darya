import type { Sentence, Token } from "@/lib/content/schema";

export type Segment =
  | { kind: "word"; token: Token; tokenIndex: number }
  | { kind: "text"; text: string };

/**
 * Re-interleave a sentence's word tokens with the punctuation/whitespace of
 * the original string, so the reader renders exactly what was written while
 * keeping every word tappable.
 */
export function segmentSentence(sentence: Sentence): Segment[] {
  const { dari, tokens } = sentence;
  const segments: Segment[] = [];
  let cursor = 0;

  tokens.forEach((token, tokenIndex) => {
    const at = dari.indexOf(token.surface, cursor);
    if (at === -1) return;
    if (at > cursor) segments.push({ kind: "text", text: dari.slice(cursor, at) });
    segments.push({ kind: "word", token, tokenIndex });
    cursor = at + token.surface.length;
  });
  if (cursor < dari.length) segments.push({ kind: "text", text: dari.slice(cursor) });

  return segments;
}
