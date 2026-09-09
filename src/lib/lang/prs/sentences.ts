/**
 * Sentence splitting for imported Dari prose.
 *
 * The Catalan splitter leans on capitalisation to confirm that a full stop
 * really ended a sentence. Perso-Arabic script has no case, so that signal does
 * not exist here and the guards have to be positive ones: digits on both sides
 * of a dot make it a decimal or a date, a single letter before it makes it an
 * initial.
 *
 * The other difference is the terminator set. Dari prose uses the Latin full
 * stop and the Arabic full stop U+06D4, and the Arabic question mark U+061F.
 * The Arabic comma (،) and semicolon (؛) are NOT terminators - treating them as
 * sentence ends is the mistake that turns a normal paragraph into fragments.
 */

import { splitByLine } from "../lines.ts";

const TERMINATOR = /[.!…؟۔]/;
const CLOSERS = new Set(["»", "”", "\"", "'", ")", "]"]);
/** Latin, Persian (۰-۹) and Arabic-Indic (٠-٩) digits. */
const DIGIT = /[0-9۰-۹٠-٩]/;

const MAX_SENTENCE_CHARS = 400;

function wordBefore(text: string, dotIndex: number): string {
  let start = dotIndex;
  while (start > 0 && !/[\s(«"']/.test(text[start - 1])) start--;
  return text.slice(start, dotIndex);
}

function endsSentence(text: string, i: number): boolean {
  const ch = text[i];
  if (!TERMINATOR.test(ch)) return false;

  if (ch === ".") {
    const prev = text[i - 1] ?? "";
    const next = text[i + 1] ?? "";
    if (DIGIT.test(prev) && DIGIT.test(next)) return false;
    const word = wordBefore(text, i);
    if (word.length === 1 && /\p{L}/u.test(word)) return false;
  }

  let j = i + 1;
  while (j < text.length && CLOSERS.has(text[j])) j++;
  if (j >= text.length) return true;

  // A terminator that is followed immediately by a letter, with no space, is a
  // lost block boundary rather than running prose - HTML-to-text conversion
  // welds blocks together, and people paste text that has been through it. For
  // the unambiguous terminators this is safe: ؟ ! ۔ never occur inside a word
  // or a number. The Latin full stop is excluded on purpose, because there it
  // really can be a decimal, an abbreviation or a URL.
  if (ch !== "." && /\p{L}/u.test(text[j])) return true;

  // With no case signal there is nothing to check about the next word, so a
  // terminator followed by whitespace is taken at face value.
  return /\s/.test(text[j]);
}

function hardWrap(chunk: string): string[] {
  if (chunk.length <= MAX_SENTENCE_CHARS) return [chunk];
  const out: string[] = [];
  let rest = chunk;
  while (rest.length > MAX_SENTENCE_CHARS) {
    const window = rest.slice(0, MAX_SENTENCE_CHARS);
    // Arabic comma and semicolon are not sentence ends, but they are the right
    // place to break an over-long run.
    let cut = Math.max(window.lastIndexOf("، "), window.lastIndexOf("؛ "));
    if (cut <= 0) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = MAX_SENTENCE_CHARS - 1;
    out.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) out.push(rest);
  return out;
}

export function splitSentencesDari(text: string): string[] {
  return splitByLine(text, splitOneLine);
}

function splitOneLine(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    if (!endsSentence(text, i)) continue;
    let end = i + 1;
    while (end < text.length && CLOSERS.has(text[end])) end++;
    out.push(text.slice(start, end));
    start = end;
  }
  if (start < text.length) out.push(text.slice(start));

  // Returned raw. Whitespace-only fragments are folded into a neighbouring
  // sentence by `splitByLine`, which does that once over the whole text -
  // doing it here too would discard a blank line before it got there.
  return out.flatMap((s) => hardWrap(s));
}
