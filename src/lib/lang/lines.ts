/**
 * A line break is always a sentence boundary.
 *
 * Extracted articles arrive as one line per block element, and a block boundary
 * is a sentence boundary by construction - a headline, a caption or a "view the
 * text version" link is its own unit whether or not it ends in punctuation.
 * Left to the terminator rules alone, an unpunctuated furniture line gets
 * welded onto the body sentence that follows it, and both become untranslatable
 * together.
 *
 * Shared by every language because nothing about it is language-specific; only
 * what happens *within* a line is.
 */
export function splitByLine(text: string, splitLine: (line: string) => string[]): string[] {
  const parts: string[] = [];
  // Each separator stays attached to the chunk before it, so concatenating the
  // result reproduces the input exactly - the invariant that stops a splitter
  // quietly eating part of an article the learner chose to read.
  for (const chunk of text.split(/(?<=\n)/)) {
    if (chunk.length === 0) continue;
    parts.push(...splitLine(chunk));
  }
  return coalesce(parts);
}

/**
 * Fold whitespace-only fragments into the sentence before them.
 *
 * Dropping them instead is the obvious move and it is wrong twice over: it
 * breaks the no-text-lost invariant, and a blank line between paragraphs would
 * otherwise survive as its own "sentence" with nothing in it - which the
 * document schema rejects, since a sentence must have some target text.
 */
export function coalesce(parts: string[]): string[] {
  const out: string[] = [];
  let pending = "";
  for (const part of parts) {
    if (part.length === 0) continue;
    if (part.trim().length === 0) {
      // Attach to the sentence before it, or hold it for the one after when
      // there is no sentence before it yet. Never drop it: that both loses text
      // and can leave a "sentence" with no words in it, which the document
      // schema rejects.
      if (out.length > 0) out[out.length - 1] += part;
      else pending += part;
      continue;
    }
    out.push(pending + part);
    pending = "";
  }
  if (pending.length > 0 && out.length > 0) out[out.length - 1] += pending;
  // Only reachable when the whole input was blank, so there is nothing to lose.
  return out;
}
