import { randomUUID } from "node:crypto";
import { lexiconIndex } from "../content/load.ts";
import {
  CONTENT_FORMAT_VERSION,
  type ImportedDocument,
  type ImportedSentence,
} from "../content/schema.ts";
import { profile } from "../lang/index.ts";
import { matchKey, splitSentences, tokenize } from "../text/index.ts";

/**
 * Turn cleaned prose into a readable document.
 *
 * Mirrors `assemble` in `src/lib/ai/generate.ts` on purpose: same tokenizer,
 * same lexicon index, so a word counts as known here exactly when it counts as
 * known there. Where the two differ is what happens to a word the lexicon does
 * not have. A generated text is rejected and rewritten; an imported one keeps
 * the word, because it is the learner's article and the word is the point.
 */

/**
 * Caps. Generous - a learner who wants to read a long feature should be able to
 * - but bounded, because every sentence is a potential translation call and the
 * model budget is shared by every learner of the deployment.
 */
export const MAX_SENTENCES = 150;
export const MAX_CHARS = 15_000;
export const MIN_SENTENCES = 3;

export class ImportTooShortError extends Error {}

export interface AssembleResult {
  doc: ImportedDocument;
  truncated: boolean;
  charCount: number;
}

/**
 * Capitalised, not sentence-initial, and unresolvable: a proper noun.
 *
 * Only meaningful in a cased script. Perso-Arabic has no capitals, so Dari
 * relies on the model's `names` list for the sentences it translates and on the
 * gloss step for the rest - which is why this returns false rather than
 * guessing there.
 */
function looksLikeName(surface: string, isFirstToken: boolean): boolean {
  if (profile.dir === "rtl") return false;
  if (isFirstToken) return false;
  const first = surface[0];
  return first !== first.toLowerCase() && first === first.toUpperCase();
}

export function assembleImport(input: {
  text: string;
  title: string;
  sourceUrl: string | null;
  /** Lexeme ids this learner already knows or is learning, for the difficulty estimate. */
  familiar: ReadonlySet<string>;
}): AssembleResult {
  const capped = input.text.slice(0, MAX_CHARS);
  const all = splitSentences(capped);
  const kept = all.slice(0, MAX_SENTENCES);
  const truncated = kept.length < all.length || capped.length < input.text.length;

  if (kept.length < MIN_SENTENCES) {
    throw new ImportTooShortError(
      "There wasn't enough readable text on that page to make a reading.",
    );
  }

  const index = lexiconIndex();
  const vocab = new Set<string>();
  const oov = new Set<string>();
  let running = 0;
  let unfamiliar = 0;

  const sentences: ImportedSentence[] = kept.map((raw) => {
    const target = raw.trim();
    const tokens = tokenize(target).map((surface, i) => {
      running++;
      const entry = index.resolve(surface);
      if (entry) {
        vocab.add(entry.id);
        if (!input.familiar.has(entry.id)) unfamiliar++;
        return { surface, lexemeId: entry.id };
      }
      unfamiliar++;
      const name = looksLikeName(surface, i === 0);
      if (!name) oov.add(matchKey(surface));
      return name
        ? { surface, lexemeId: null, kind: "name" as const }
        : { surface, lexemeId: null };
    });
    // `en` empty means "not translated yet" - the import translates the title
    // and the opening sentences, and the rest when the learner opens them.
    return { target, en: "", tokens };
  });

  const doc: ImportedDocument = {
    id: `tx-imp-${randomUUID()}`,
    formatVersion: CONTENT_FORMAT_VERSION,
    titleTarget: input.title.trim() || sentences[0].target.slice(0, 60),
    titleEn: "",
    sentences,
    vocabUsed: [...vocab].sort(),
    oovSurfaces: [...oov].sort(),
    newWordRatio: running === 0 ? 0 : unfamiliar / running,
    source: "imported",
    sourceUrl: input.sourceUrl,
    createdAt: new Date().toISOString(),
  };

  return { doc, truncated, charCount: capped.length };
}
