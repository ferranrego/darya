import type { LexiconEntry } from "../content/schema.ts";
import { matchKey, ZWNJ } from "./normalize.ts";

/**
 * Fast surface-form → lexeme lookup. Headwords win over variants when both
 * claim the same key (homograph policy, see content/lexicon/README.md).
 */
export interface LexiconIndex {
  byId: Map<string, LexiconEntry>;
  resolve: (surface: string) => LexiconEntry | null;
}

export function buildLexiconIndex(entries: LexiconEntry[]): LexiconIndex {
  const byId = new Map<string, LexiconEntry>();
  const headwords = new Map<string, LexiconEntry>();
  const variants = new Map<string, LexiconEntry>();

  for (const entry of entries) {
    byId.set(entry.id, entry);
    headwords.set(matchKey(entry.dariNormalized), entry);
    for (const v of entry.variants) {
      const key = matchKey(v);
      if (!variants.has(key)) variants.set(key, entry);
    }
  }

  return {
    byId,
    resolve(surface: string) {
      const key = matchKey(surface);
      
      // 1. Exact match (Headword or Variant)
      let match = headwords.get(key) ?? variants.get(key);
      if (match) return match;

      // 2. Basic Stemmer for common Persian enclitics, plural markers, and comparatives
      const suffixes = [
        "یم", "ید", "ند", // verb endings (we, you pl, they)
        "ام", "ای", "ایم", "اید", "اند", // verb endings after vowels
        "ها", "ان", // plurals
        "تر", "ترین", // comparative / superlative
        "م", "ت", "ش", "ی", // possessives / singular verb endings
      ];

      for (const suffix of suffixes) {
        if (key.endsWith(suffix) && key.length > suffix.length + 1) {
          const root = key.slice(0, -suffix.length);
          // Strip ZWNJ if it was placed immediately before the suffix (e.g., خانه-ام)
          const cleanRoot = root.endsWith(ZWNJ) ? root.slice(0, -1) : root;
          
          match = headwords.get(cleanRoot) ?? variants.get(cleanRoot);
          if (match) return match;
        }
      }

      return null;
    },
  };
}
