import { normalize } from "../text/index.ts";

/**
 * Turn extracted page text into prose worth reading.
 *
 * The order here is load-bearing. Normalization happens LAST but before
 * anything is split or tokenized, because the reader re-finds each token in its
 * sentence with `target.indexOf(surface, cursor)` (see
 * `src/components/reader/segments.ts`) and silently drops any token it cannot
 * find. If the stored sentence is not the exact string the tokenizer saw, words
 * vanish from the page with nothing thrown.
 */

/**
 * Zero-width and invisible characters that are always noise.
 *
 * ZWNJ (U+200C) is deliberately absent: it is a letter-joining control in
 * Perso-Arabic script, and stripping it turns می‌روم into میروم - a different
 * word that resolves to nothing. A generic "remove zero-width characters"
 * pass is exactly how that breaks.
 */
const INVISIBLE = /[​‎‏⁠﻿­]/g;

/** A line with no sentence-final punctuation and few words is page furniture. */
const MIN_BARE_LINE_CHARS = 30;
const SENTENCE_END = /[.!?…؟۔]\s*$/;

/** Nav and share widgets that survive extraction, matched case-insensitively. */
const FURNITURE =
  /^(share|tweet|print|subscribe|advertisement|comparteix|imprimeix|subscriu|publicitat|related|llegiu també|més notícies)\b/i;

export function cleanArticleText(raw: string): string {
  const withoutInvisible = raw
    .replace(INVISIBLE, "")
    .replace(/ /g, " ")
    .replace(/\r\n?/g, "\n");

  const lines = withoutInvisible
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter((line) => {
      if (line.length === 0) return false;
      if (FURNITURE.test(line)) return false;
      // Short and unpunctuated: a byline, a caption, a menu item.
      if (line.length < MIN_BARE_LINE_CHARS && !SENTENCE_END.test(line)) return false;
      return true;
    });

  // Consecutive duplicate lines are the same widget rendered twice.
  const deduped = lines.filter((line, i) => line !== lines[i - 1]);

  return normalize(deduped.join("\n"));
}
