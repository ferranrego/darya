/**
 * Sentence splitting for imported Catalan prose.
 *
 * Nothing the app writes needs this - generated and authored texts arrive
 * already split into sentences. It exists for articles the learner brings in,
 * which is the hard case: a full stop ends a sentence most of the time, and the
 * exceptions (abbreviations, ordinals, decimals, initials) are exactly what a
 * news article is full of.
 *
 * The signal Catalan gives us and Dari does not is capitalisation: a sentence
 * starts with a capital, an opening quote, or a digit.
 */

/** Terminators, plus the closing marks that may follow one. */
import { splitByLine } from "../lines.ts";

const TERMINATOR = /[.!?…]/;
const CLOSERS = new Set(["»", "”", "\"", "'", ")", "]", "'"]);

/**
 * Words whose trailing dot is part of the word. Deliberately a small, checked
 * list rather than a heuristic: over-splitting a real article is visible and
 * annoying, and every entry here is a form that actually appears in Catalan
 * journalism.
 */
const ABBREVIATIONS = new Set([
  "sr", "sra", "srs", "sres", "dr", "dra", "drs", "dres",
  "st", "sta", "sts", "stes",
  "núm", "pàg", "pàgs", "p", "pp", "ex", "etc", "vg", "cf",
  "av", "c", "pl", "ptge", "ctra", "apdo",
  "ed", "eds", "trad", "coord", "dir", "vol", "vols", "cap", "art",
  "aprox", "màx", "mín", "tel", "fax", "adr",
  "a.c", "d.c", "s", "ss", "hab", "esq",
  "1r", "2n", "3r", "4t", "5è", "1a", "2a", "3a", "4a",
]);

/**
 * Longest run of prose kept as one sentence. A page whose punctuation the
 * extractor lost would otherwise become a single unreadable block with every
 * tap-to-translate call covering the whole article.
 */
const MAX_SENTENCE_CHARS = 400;

function isUpperStart(ch: string): boolean {
  return ch !== ch.toLowerCase() && ch === ch.toUpperCase();
}

/** The word immediately before a dot, lowercased and stripped of leading punctuation. */
function wordBefore(text: string, dotIndex: number): string {
  let start = dotIndex;
  while (start > 0 && !/[\s(«"']/.test(text[start - 1])) start--;
  return text.slice(start, dotIndex).toLowerCase();
}

function endsSentence(text: string, i: number): boolean {
  const ch = text[i];
  if (!TERMINATOR.test(ch)) return false;

  if (ch === ".") {
    const prev = text[i - 1] ?? "";
    const next = text[i + 1] ?? "";
    // Decimal or a date like 12.03.2026 - digits on both sides of the dot.
    if (/\d/.test(prev) && /\d/.test(next)) return false;
    // "J. Pujol": a single letter before the dot is an initial.
    const word = wordBefore(text, i);
    if (word.length === 1 && /\p{L}/u.test(word)) return false;
    if (ABBREVIATIONS.has(word)) return false;
    // "a.c." style: the abbreviation set holds the dotted form.
    if (ABBREVIATIONS.has(word.replace(/\.$/, ""))) return false;
  }

  // Walk past closing quotes and brackets so `«...!»` breaks after the guillemet.
  let j = i + 1;
  while (j < text.length && CLOSERS.has(text[j])) j++;
  // End of input is a sentence end.
  if (j >= text.length) return true;
  // A terminator followed immediately by an uppercase letter, with no space, is
  // a lost block boundary - HTML-to-text conversion welds blocks together, and
  // people paste text that has been through it. Requiring uppercase keeps this
  // away from decimals, abbreviations and URLs.
  if (isUpperStart(text[j])) return true;

  // Otherwise require whitespace, then a plausible sentence opener.
  if (!/\s/.test(text[j])) return false;
  while (j < text.length && /\s/.test(text[j])) j++;
  if (j >= text.length) return true;
  const opener = text[j];
  return isUpperStart(opener) || /[«"'¿¡(\d—-]/.test(opener);
}

/**
 * Break a run with no sentence-final punctuation at the nearest comma or space
 * before the limit, so one long block still reads as several tappable units.
 */
function hardWrap(chunk: string): string[] {
  if (chunk.length <= MAX_SENTENCE_CHARS) return [chunk];
  const out: string[] = [];
  let rest = chunk;
  while (rest.length > MAX_SENTENCE_CHARS) {
    const window = rest.slice(0, MAX_SENTENCE_CHARS);
    let cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "));
    if (cut <= 0) cut = window.lastIndexOf(" ");
    if (cut <= 0) cut = MAX_SENTENCE_CHARS - 1;
    out.push(rest.slice(0, cut + 1));
    rest = rest.slice(cut + 1);
  }
  if (rest) out.push(rest);
  return out;
}

export function splitSentencesCatalan(text: string): string[] {
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
