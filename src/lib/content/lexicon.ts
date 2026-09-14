/**
 * The shipped lexicon: 6,500+ entries, parsed and indexed.
 *
 * The heaviest module in the app, kept apart on purpose. Importing it from a
 * client component puts a 3.56 MB (765 KB gzip) chunk into that route, so only
 * the screens that genuinely resolve words at render time - the reader, review,
 * the vocabulary browser and the placement - may reach it. It used to live in
 * `load.ts` alongside `levels`, and the app shell imported `levels`, so every
 * authenticated page paid for it. `scripts/check-bundle.ts` holds the line.
 */
import lexiconJson from "@content/lexicon/lexicon.json";
import { isFlattenedTranslit } from "../lang/prs/translit-check";
import { buildIndex, type LexiconIndex } from "../text";
import { lexiconFileSchema, type LexiconEntry, type LexiconFile } from "./schema";

/**
 * Hide an example sentence's transliteration when it was written in Iranian
 * Persian rather than Dari.
 *
 * 1,208 entries carry one: every long ā and every majhul ē/ō flattened away,
 * so `anjām wa ghāyat-i insān rasēdan ba kamāl-i mutlaq ast` reaches a learner
 * as `Anjam va ghayat-e ensan residan be kamal-e motlaq ast`. All but six came
 * from one bulk generation pass over lx-3000..lx-5999. They surface in the
 * reader's word sheet and the vocabulary browser, and since the app has no
 * audio that line is the only pronunciation anyone gets - so tapping one of
 * these words teaches an Iranian accent, the defect PEDAGOGY §9 ranks first.
 *
 * Repairing 1,208 sentences is philology, not a script: measured, only 49% of
 * their tokens resolve to a lemma whose own transliteration can be trusted,
 * and *no* sentence is fully covered - 20% of tokens are inflected forms the
 * morphology engine carries no transliteration for, and another 20% do not
 * resolve at all. So the repair is authored in reviewed batches, and until a
 * sentence is repaired the app shows none rather than a wrong one. CLAUDE.md:
 * a wrong entry is worse than a missing one.
 *
 * Deliberately a *rule* and not a list of ids: an entry starts displaying
 * again the moment its transliteration is fixed, so the exemption cannot
 * outlive the defect and there is nothing to keep in sync.
 */
function withoutFlattenedExamples(file: LexiconFile): LexiconFile {
  let hidden = 0;
  const entries = file.entries.map((e) => {
    if (!isFlattenedTranslit(e.exampleTranslit, e.exampleTarget, e.id)) return e;
    hidden++;
    return { ...e, exampleTranslit: undefined };
  });
  return hidden === 0 ? file : { ...file, entries };
}

export const lexicon: LexiconFile = withoutFlattenedExamples(
  lexiconFileSchema.parse(lexiconJson),
);

let index: LexiconIndex | null = null;
export function lexiconIndex(): LexiconIndex {
  index ??= buildIndex(lexicon.entries);
  return index;
}

export function lexemeById(id: string): LexiconEntry | undefined {
  return lexiconIndex().byId.get(id);
}

export function getWordsByThemeOnly(theme: string): LexiconEntry[] {
  return lexicon.entries.filter((word) => {
    return word.tags?.includes(theme);
  });
}
