import type { LexiconEntry } from "../content/schema.ts";
import { matchKey } from "./normalize.ts";

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
      return headwords.get(key) ?? variants.get(key) ?? null;
    },
  };
}
