/**
 * Catalan text normalization and tokenization.
 *
 * Catalan is Latin-script and left-to-right, so none of Dari's script handling
 * applies. The pitfalls are different and mostly orthographic:
 *
 *   - **Elision apostrophes**: `l'home`, `d'aigua`, `s'ha`, `n'hi`. The clitic
 *     and the word are separate lexical units and must tokenize apart, or every
 *     word following an article is unresolvable.
 *   - **Interpunct (l·l)**: `col·legi`, `paral·lel`. U+00B7 is *inside* a word
 *     and must never split it. Real text also uses U+2027 and a bare `.` as
 *     lazy substitutes.
 *   - **Enclitic pronouns**: `dóna'm`, `anar-se'n`, `dona-me'l`. Hyphens and
 *     apostrophes both attach pronouns after a verb.
 *   - **Accents carry meaning**: `si`/`sí`, `es`/`és`, `mes`/`més`, `dona`/`dóna`
 *     are different words. They are preserved everywhere, including in
 *     `matchKey` - see the note there for why folding them is a trap.
 */

/** U+00B7 MIDDLE DOT is the correct interpunct; the others are common substitutes. */
const INTERPUNCT = /[·‧∙]/g;
/** Curly apostrophe → straight, so both spellings share one key. */
const CURLY_APOSTROPHE = /[’ʼ]/g;

/** The apostrophes that elide a clitic onto the next word: l', d', s', n', m', t'. */
const ELIDING_CLITIC = /^(l|d|s|n|m|t|L|D|S|N|M|T)'/;

export const INTERPUNCT_CHAR = "·";

/**
 * Canonical, display-safe form: NFC, straight apostrophes, canonical interpunct.
 * Case and accents are preserved - both are meaningful in Catalan.
 */
export function normalizeCatalan(input: string): string {
  return input
    .normalize("NFC")
    .replace(CURLY_APOSTROPHE, "'")
    .replace(INTERPUNCT, INTERPUNCT_CHAR)
    .trim();
}

/**
 * Lookup key: lowercase, interpunct flattened. Accents are NOT folded.
 *
 * Folding them looks helpful and is not. This app is a reader: the learner taps
 * a word in rendered text that already carries its accents, so they never type
 * an unaccented form. Folding therefore buys nothing, and it destroys minimal
 * pairs that Catalan genuinely distinguishes - `si`/`sí`, `es`/`és`,
 * `mes`/`més`, `dona`/`dóna` - which then collide as duplicate lexicon keys and
 * silently lose one sense.
 *
 * The interpunct is still flattened, since `col·legi` and a sloppily typed
 * `collegi` are the same word rather than two.
 */
export function matchKey(input: string): string {
  return normalizeCatalan(input).toLowerCase().split(INTERPUNCT_CHAR).join("");
}

/** Letters that can appear inside a Catalan word, plus the interpunct. */
const WORD_CHAR = /[\p{L}\p{M}·]/u;

/**
 * Split Catalan text into word tokens.
 *
 * Hand-rolled rather than `Intl.Segmenter` because the segmenter splits
 * `col·legi` on the interpunct and joins `l'home` into one token - exactly
 * backwards from what the lexicon needs.
 *
 * Rules:
 *   - an eliding clitic (`l'`, `d'`, `s'`…) becomes its own token, keeping its
 *     apostrophe so it can be distinguished from a bare letter;
 *   - an apostrophe or hyphen *after* the first letter is enclitic, so
 *     `dóna'm` yields `dóna` + `'m` and `anar-se'n` yields `anar` + `se` + `'n`;
 *   - interpunct never splits.
 */
export function tokenizeCatalan(text: string): string[] {
  const normalized = normalizeCatalan(text);
  const out: string[] = [];

  for (const raw of normalized.split(/[\s ]+/)) {
    if (!raw) continue;
    // Strip surrounding punctuation but keep internal apostrophes/hyphens.
    let chunk = raw.replace(/^[^\p{L}\p{M}]+/u, "").replace(/[^\p{L}\p{M}'·-]+$/u, "");
    if (!chunk) continue;

    // Leading eliding clitics can stack: "d'l'" is not real, but "l'" + rest is.
    let guard = 0;
    while (guard++ < 4) {
      const m = chunk.match(ELIDING_CLITIC);
      if (!m || chunk.length <= m[0].length) break;
      out.push(m[0]);
      chunk = chunk.slice(m[0].length);
    }
    if (!chunk) continue;

    // Split enclitics that follow the stem: hyphen, or apostrophe not at
    // index 0. Every hyphen part is checked, not just the first - `anar-se'n`
    // carries a pronoun on each side of the hyphen.
    const parts = chunk.split(/-/).flatMap(splitTrailingApostrophe);

    for (const p of parts) {
      const cleaned = p.replace(/^'+|'+$/g, (m, ...a) => (a[a.length - 2] === 0 ? m : ""));
      const token = cleaned || p;
      if (token && WORD_CHAR.test(token)) out.push(token);
    }
  }
  return out;
}

/** `dóna'm` → ["dóna", "'m"]; a word with no enclitic comes back untouched. */
function splitTrailingApostrophe(word: string): string[] {
  const at = word.indexOf("'");
  if (at <= 0 || at === word.length - 1) return [word];
  return [word.slice(0, at), word.slice(at)];
}
