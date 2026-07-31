import type { LexiconEntry, Level } from "./schema.ts";

/**
 * Which words a generated text is built from.
 *
 * Pulled out of the route handler so it can be tested against the real
 * lexicons at every level, because the failures here are silent. A text is
 * still fluent, still level-appropriate, still passes the coverage gate - and
 * teaches nothing, or teaches nine nouns in a row. Measured before this module
 * existed, the share of requested new words a text actually used was 2/2 at L1
 * but 0/5 at B2 and 0/7 at C1, with new-word parts of speech `noun:5` and
 * `noun:7`.
 *
 * Deliberately free of `server-only` and of any prompt text: this decides
 * *which* words, `ai/generate.ts` decides how to ask for them.
 */

/**
 * Both lexicons are roughly three-quarters nouns (ca 73.9%, prs 78.4%), so a
 * plain frequency slice of unknown words is nearly all nouns by construction.
 * That is not a stylistic complaint - a reader that only ever introduces nouns
 * cannot teach the verb and adjective morphology the levels claim to cover.
 */
const MAX_NOUN_SHARE = 0.55;

/**
 * A text that teaches four words well beats one listing fifteen.
 *
 * The old ceiling was 15, and at the top levels the model simply ignored the
 * list - asking for less is what makes the request answerable.
 */
const MAX_TARGETS = 8;
const MIN_TARGETS = 2;

/** Deterministic PRNG so a seeded selection can be asserted in a test. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Uniform shuffle.
 *
 * `sort(() => Math.random() - 0.5)` is not one: the comparator is inconsistent,
 * so the result depends on the sort implementation and heavily favours leaving
 * elements near where they started. Applied to a frequency-ordered candidate
 * list, that means the same handful of words kept being chosen.
 */
export function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * How many new words a text of this level should introduce.
 *
 * Uses the level's own `avgSentenceWords`, which is derived from its
 * `sentenceLengthHint`. The route used to recompute this from the sentence
 * *count* plus a constant, which has nothing to do with sentence length.
 */
export function targetCountFor(level: Level, newWordRatio: number): number {
  const midSentences = (level.sentenceRange[0] + level.sentenceRange[1]) / 2;
  const expectedTokens = midSentences * level.avgSentenceWords;
  return Math.max(MIN_TARGETS, Math.min(MAX_TARGETS, Math.round(expectedTokens * newWordRatio)));
}

const isNoun = (e: LexiconEntry) => e.pos === "noun";
const isVerb = (e: LexiconEntry) => e.pos === "verb";
const isModifier = (e: LexiconEntry) => e.pos === "adjective" || e.pos === "adverb";

export interface SelectTargetsInput {
  /** Candidate pool: unknown, teachable, inside the level's bands. */
  candidates: readonly LexiconEntry[];
  count: number;
  /** Seed for a reproducible pick; omit for a random one. */
  seed?: number;
}

/**
 * The words a text is being written to teach.
 *
 * Frequency-first, then quota'd by part of speech. Quotas degrade rather than
 * throw: a level whose remaining vocabulary genuinely holds no verbs should
 * still produce a text, just a noun-heavy one. Refusing to generate would trade
 * a mediocre text for no text at all.
 */
export function selectTargets({ candidates, count, seed }: SelectTargetsInput): LexiconEntry[] {
  if (count <= 0 || candidates.length === 0) return [];
  const rand = mulberry32(seed ?? (Math.random() * 2 ** 32) >>> 0);

  const byRank = [...candidates].sort((a, b) => a.freqRank - b.freqRank);
  // Draw the bulk from a frequency-ordered head rather than the whole tail, so
  // the words taught stay the most useful ones available, then shuffle inside
  // that head so consecutive texts at one level do not repeat.
  const pool = shuffle(byRank.slice(0, Math.max(count * 6, 40)), rand);

  const picked: LexiconEntry[] = [];
  const taken = new Set<string>();
  // Different lexemes can share a surface form, and teaching the same written
  // word twice in one text reads as a mistake.
  const surfaces = new Set<string>();
  const add = (entry: LexiconEntry): boolean => {
    if (taken.has(entry.id) || surfaces.has(entry.targetNormalized)) return false;
    taken.add(entry.id);
    surfaces.add(entry.targetNormalized);
    picked.push(entry);
    return true;
  };

  // Seed one verb and one modifier first so they are never crowded out by the
  // far more numerous nouns. These search the *whole* candidate list, not the
  // head: at the upper levels the most frequent unknown words are all nouns
  // (Dari band 9 is 962 nouns out of 965), so a head-only search found no verb
  // and the quota silently did nothing at exactly the levels that needed it.
  const nounCap = Math.max(1, Math.floor(count * MAX_NOUN_SHARE));
  for (const wanted of [isVerb, isModifier]) {
    if (picked.length >= count) break;
    const hit = byRank.find((e) => wanted(e) && !taken.has(e.id));
    if (hit) add(hit);
  }

  for (const entry of pool) {
    if (picked.length >= count) break;
    if (isNoun(entry) && picked.filter(isNoun).length >= nounCap) continue;
    add(entry);
  }

  // The noun cap is a preference, not a hard limit: if honouring it would
  // return fewer words than asked for, fill the remainder with what is left.
  for (const entry of pool) {
    if (picked.length >= count) break;
    add(entry);
  }

  return picked.sort((a, b) => a.freqRank - b.freqRank);
}

export interface SelectKnownInput {
  /** Every word the learner knows that is worth showing the model. */
  known: readonly LexiconEntry[];
  level: Level;
  /** Lexemes due for review, weighted to the front so texts rehearse them. */
  dueIds?: ReadonlySet<string>;
}

/**
 * The known-word list shown to the model.
 *
 * This is a *prompt* slice, not a statement about what the learner knows - see
 * the note on `knownIds` in `ai/generate.ts`. It is capped because the list is
 * context on a free tier and past a few hundred words the model stops reading
 * it, and it is frequency-ordered so the words it does read are the reusable
 * ones.
 *
 * Words that are due for review are moved to the front. They are already known,
 * so this changes which known words the text is likely to reuse rather than
 * what it teaches - the reader feeds the review queue today, and this is the
 * only path back the other way.
 */
export function selectKnown({ known, level, dueIds }: SelectKnownInput): LexiconEntry[] {
  const budget = Math.max(160, Math.min(600, Math.round(level.entryKnownWords * 0.5) || 160));
  const byRank = [...known].sort((a, b) => a.freqRank - b.freqRank);
  if (!dueIds || dueIds.size === 0) return byRank.slice(0, budget);

  const due = byRank.filter((e) => dueIds.has(e.id));
  const rest = byRank.filter((e) => !dueIds.has(e.id));
  // Due words never take more than half the budget; the rest of the list still
  // has to be able to carry a coherent text.
  return [...due.slice(0, Math.floor(budget / 2)), ...rest].slice(0, budget);
}
