import type { HubEntry } from "../content/schema.ts";
import { matchKey } from "../text/index.ts";

/**
 * Find Grammar Hub pages for whatever a learner typed.
 *
 * The people searching mostly do not know what the rule is called, and when
 * they do they spell it the way they heard it: "hezafe", "izafat", "me prefix".
 * So Latin input is folded hard - case, macrons (mē → me), hyphens - and
 * matched against the page's hand-written aliases first, then its title,
 * keywords and summary. A single typo is forgiven on longer words. Dari input
 * is matched on the script through the language's own `matchKey`.
 *
 * Runs on the device over a few dozen pages: no index, no library, no network.
 */

export interface HubHit {
  entry: HubEntry;
  score: number;
}

/** Scores, highest first. Exact alias beats title beats keyword beats summary beats Dari. */
const SCORE = {
  aliasExact: 100,
  titleExact: 90,
  aliasPrefix: 70,
  titleWord: 60,
  keyword: 45,
  typo: 35,
  summary: 20,
  dari: 50,
} as const;

/** Lowercase, strip macrons and other combining marks, turn hyphens into spaces. */
export function foldLatin(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[-_'’`"]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ARABIC_SCRIPT = /[؀-ۿ]/;

/** Levenshtein distance, stopping early once it exceeds `max`. */
function withinEdits(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

function words(text: string): string[] {
  return foldLatin(text).split(" ").filter(Boolean);
}

function scoreLatin(entry: HubEntry, q: string): number {
  const qWords = q.split(" ");
  const aliases = entry.aliases.map(foldLatin);
  const title = foldLatin(entry.title);
  const titleWords = words(entry.title);
  const keywords = entry.keywords.map(foldLatin);
  let best = 0;
  const bump = (n: number) => {
    if (n > best) best = n;
  };

  if (aliases.includes(q) || entry.slug.replace(/-/g, " ") === q) bump(SCORE.aliasExact);
  if (title === q) bump(SCORE.titleExact);
  if (q.length >= 2 && aliases.some((a) => a.startsWith(q))) bump(SCORE.aliasPrefix);
  // Every typed word appears at the start of some title word.
  if (qWords.every((w) => titleWords.some((t) => t.startsWith(w)))) bump(SCORE.titleWord);
  if (keywords.some((k) => k === q || (q.length >= 3 && k.startsWith(q)))) bump(SCORE.keyword);

  // One typo on a word of five letters or more: "ezafee", "izafe" -> "ezafe".
  // Shorter words are left alone: "ra" is one edit from "na", and those are
  // two different rules.
  if (q.length >= 5 && best < SCORE.typo) {
    const candidates = [...aliases, ...titleWords, ...keywords].filter((c) => c.length >= 5);
    if (candidates.some((c) => withinEdits(q, c, 1))) bump(SCORE.typo);
  }

  if (best === 0 && q.length >= 3) {
    const summary = foldLatin(entry.summary);
    if (qWords.every((w) => summary.includes(w))) bump(SCORE.summary);
  }
  return best;
}

function scoreDari(entry: HubEntry, q: string): number {
  const key = matchKey(q);
  const haystack = [
    entry.sample.target,
    ...entry.aliases.filter((a) => ARABIC_SCRIPT.test(a)),
    ...entry.blocks.flatMap((b) => (b.type === "examples" ? b.items.map((i) => i.highlight ?? "") : [])),
  ]
    .filter(Boolean)
    .map(matchKey);
  if (haystack.some((h) => h === key)) return SCORE.dari + 10;
  return haystack.some((h) => h.includes(key)) ? SCORE.dari : 0;
}

export function searchHub(query: string, entries: HubEntry[]): HubHit[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const dari = ARABIC_SCRIPT.test(trimmed);
  const q = dari ? trimmed : foldLatin(trimmed);
  if (!q) return [];

  const order = new Map(entries.map((e, i) => [e.id, i]));
  return entries
    .map((entry) => ({ entry, score: dari ? scoreDari(entry, q) : scoreLatin(entry, q) }))
    .filter((hit) => hit.score > 0)
    // Ties keep book order, so the easier page of two equal matches comes first.
    .sort((a, b) => b.score - a.score || order.get(a.entry.id)! - order.get(b.entry.id)!);
}
