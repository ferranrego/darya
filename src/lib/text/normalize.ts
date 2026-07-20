/**
 * Dari text normalization and tokenization.
 *
 * Dari uses Persian orthography; the pitfalls are mixed Arabic/Persian
 * codepoints in source data and ZWNJ-joined compounds. Every string that gets
 * matched against the lexicon must pass through `normalizeDari` on both sides.
 */

const ARABIC_YEH = /ي/g; // ي → ی
const ARABIC_KAF = /ك/g; // ك → ک
const ALEF_VARIANTS = /[آأإ]/g; // آأإ handled separately below
const DIACRITICS = /[ً-ْٰ]/g; // tanwin/harakat; strip for matching
const TATWEEL = /ـ/g;

export const ZWNJ = "‌";

/** Canonical form stored in `dariNormalized`; display-safe (keeps آ). */
export function normalizeDari(input: string): string {
  return input
    .normalize("NFC")
    .replace(ARABIC_YEH, "ی")
    .replace(ARABIC_KAF, "ک")
    .replace(TATWEEL, "")
    .trim();
}

/** Aggressive form used only as a lookup key (strips diacritics, folds alefs). */
export function matchKey(input: string): string {
  return normalizeDari(input)
    .replace(DIACRITICS, "")
    .replace(ALEF_VARIANTS, "ا");
}

const faSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter("fa", { granularity: "word" })
    : null;

/**
 * Split Dari text into word tokens (punctuation and whitespace dropped).
 * ZWNJ-joined compounds (e.g. می‌روم) come back as single tokens.
 */
export function tokenizeDari(text: string): string[] {
  const normalized = normalizeDari(text);
  if (!faSegmenter) {
    return normalized.split(/[\s،؛؟.!?،؛؟"'«»()]+/).filter(Boolean);
  }
  const out: string[] = [];
  for (const seg of faSegmenter.segment(normalized)) {
    if (!seg.isWordLike) continue;
    out.push(seg.segment);
  }
  // Intl.Segmenter splits on ZWNJ in some ICU versions; re-join those pieces.
  return rejoinZwnj(normalized, out);
}

function rejoinZwnj(source: string, tokens: string[]): string[] {
  if (!source.includes(ZWNJ)) return tokens;
  const out: string[] = [];
  let cursor = 0;
  for (const token of tokens) {
    const at = source.indexOf(token, cursor);
    const prevEnd = out.length > 0 ? cursor : -1;
    // If the previous token ends exactly one ZWNJ before this one, merge them.
    if (
      out.length > 0 &&
      at === prevEnd + 1 &&
      source[prevEnd] === ZWNJ
    ) {
      out[out.length - 1] = out[out.length - 1] + ZWNJ + token;
    } else {
      out.push(token);
    }
    cursor = at + token.length;
  }
  return out;
}
