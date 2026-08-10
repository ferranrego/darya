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
 * The opposite failure, caught the same way: a candidate pool can be
 * verb-heavy instead of noun-heavy, and nothing before this capped that
 * direction. Measured live - Dari C1's candidate pool, once `entryKnownWords`
 * was corrected to the vocabulary the lexicon actually supports, is 88 verbs
 * against 65 nouns and zero adjectives/adverbs at all (a small pool at the
 * very tail of the lexicon, where rare specialised verbs happen to cluster).
 * `selectTargets` seeds one verb deliberately and would otherwise fill the
 * rest of the count from whichever part of speech the pool has more of - a
 * text that teaches eight verb conjugations and no vocabulary to hang them on
 * is exactly the "nine nouns in a row" failure this module exists to prevent,
 * with the part of speech swapped.
 */
const MAX_VERB_SHARE = 0.55;

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

  // At a beginner level, the text is now a cohesive micro-narrative.
  // Previously we asked for 2 new words per sentence (e.g. 8 words for a 4 sentence text),
  // which works for disjointed sentences but is impossible to weave into a continuous
  // story without hallucinating outside vocabulary. We reduce this to 1 word per sentence.
  if (isBeginnerLevel(level)) {
    return Math.max(MIN_TARGETS, Math.min(4, Math.round(midSentences * 1)));
  }

  const expectedTokens = midSentences * level.avgSentenceWords;
  return Math.max(MIN_TARGETS, Math.min(MAX_TARGETS, Math.round(expectedTokens * newWordRatio)));
}

/**
 * The tag that makes a word teachable early regardless of its rank.
 *
 * Frequency decides teaching order and does not decide what a beginner needs
 * on day one - no corpus does, because concrete nouns are rarer in text than
 * abstract ones. Catalan's L1 head is `estat`, `cosa`, `part`, `manera`,
 * `sistema`, while `poma` ranks 1468 and `carn` 818, so half the sentences a
 * first-week learner should be reading were not expressible at their level.
 * See content/<lang>/lexicon/beginner-core.txt.
 */
export const BEGINNER_CORE_TAG = "beginner-core";

/**
 * The levels that get useful sentences rather than a text.
 *
 * Keyed off the CEFR label, not the sentence length. Length looked like the
 * more robust signal and is not: Dari A2 averages seven words and Catalan A2
 * nine, so a threshold on it silently made A2 a beginner level in one language
 * and not the other. Above A1 a learner can hold a text together, and should.
 */
const BEGINNER_HINTS = new Set(["pre-A1", "A1"]);

export function isBeginnerLevel(level: Level): boolean {
  return BEGINNER_HINTS.has(level.cefrHint.trim());
}

/**
 * The words a level may teach.
 *
 * In-band by frequency, plus the curated beginner core at the first levels.
 * The core is additive: it never removes a word, never changes `freqRank`, and
 * never makes a word count as *known* - `placementCredit` is untouched, so
 * these are words the learner is taught, not words assumed.
 */
export function teachablePool(
  entries: readonly LexiconEntry[],
  level: Level,
  isKnown: (e: LexiconEntry) => boolean,
  isUsable: (e: LexiconEntry) => boolean,
): LexiconEntry[] {
  const beginner = isBeginnerLevel(level);
  return entries.filter(
    (e) =>
      !isKnown(e) &&
      isUsable(e) &&
      (level.freqBands.includes(e.freqBand) ||
        (beginner && e.tags.includes(BEGINNER_CORE_TAG))),
  );
}

/**
 * Words that carry meaning, as opposed to the closed classes that hold a
 * sentence together. A learner is *taught* these; they absorb `de` and `el`
 * from every sentence that uses one.
 */
const CONTENT_POS = new Set(["noun", "verb", "adjective", "adverb"]);
const isContentWord = (e: LexiconEntry) => CONTENT_POS.has(e.pos);

const isNoun = (e: LexiconEntry) => e.pos === "noun";
const isVerb = (e: LexiconEntry) => e.pos === "verb";
const isModifier = (e: LexiconEntry) => e.pos === "adjective" || e.pos === "adverb";

export interface SelectTargetsInput {
  /** Candidate pool: unknown, teachable, inside the level's bands. */
  candidates: readonly LexiconEntry[];
  count: number;
  /** Seed for a reproducible pick; omit for a random one. */
  seed?: number;
  /**
   * Take the curated beginner core first.
   *
   * Putting those words in the pool is not enough: selection is
   * frequency-first, and they rank low precisely because concrete words are
   * rare in text. Without this, a pre-A1 text was still built from `aturar`,
   * `fora`, `canvi`, `país`, `potser` - grammatically fine at rank 200 and
   * useless as a first week's vocabulary, when `poma`, `gos` and `taula` were
   * sitting in the same pool unreachable.
   */
  preferBeginnerCore?: boolean;
}

/**
 * The words a text is being written to teach.
 *
 * Frequency-first, then quota'd by part of speech. Quotas degrade rather than
 * throw: a level whose remaining vocabulary genuinely holds no verbs should
 * still produce a text, just a noun-heavy one. Refusing to generate would trade
 * a mediocre text for no text at all.
 */
export function selectTargets({
  candidates,
  count,
  seed,
  preferBeginnerCore,
}: SelectTargetsInput): LexiconEntry[] {
  if (count <= 0 || candidates.length === 0) return [];
  const rand = mulberry32(seed ?? (Math.random() * 2 ** 32) >>> 0);

  // Within the beginner core, prefer words worth *teaching*.
  //
  // The core covers closed classes too, because a beginner needs `el`, `de`,
  // `amb` and `que` - but it needs them as the mortar of a sentence, not as
  // vocabulary cards. Ranking the whole core equally made pre-A1 teach
  // `ser, la, no, amb, es, què, pel`: seven of ten slots spent on function
  // words at rank 1-40, crowding out `gos`, `poma` and `casa`, which is the
  // exact failure the core was introduced to fix. Closed-class members are
  // still boosted over non-core words, just behind the content words.
  const rank = (e: LexiconEntry) => {
    if (!preferBeginnerCore || !e.tags.includes(BEGINNER_CORE_TAG)) return e.freqRank;
    return e.freqRank - (isContentWord(e) ? 2e6 : 1e6);
  };
  const byRank = [...candidates].sort((a, b) => rank(a) - rank(b));

  // Draw the bulk from a frequency-ordered head rather than the whole tail, so
  // the words taught stay the most useful ones available, then shuffle inside
  // that head so consecutive texts at one level do not repeat.
  //
  // At a beginner level the head is the wrong pool. Ordering the core by corpus
  // frequency and taking the top 60 reaches `home, parlar, pensar, moment,
  // també` and never `gos` (rank 1546), `poma` (1468) or `taula` (1161) - which
  // is the premise of the core restated as a bug: frequency in text is not what
  // a beginner needs first, so it must not decide the order *inside* the core
  // either. The whole core is the pool, shuffled, so texts draw from all of it.
  const core = byRank.filter((e) => e.tags.includes(BEGINNER_CORE_TAG) && isContentWord(e));
  const coreIds = new Set(core.map((e) => e.id));
  const beginnerPool = preferBeginnerCore && core.length >= count;
  const pool = beginnerPool
    ? [...shuffle(core, rand), ...byRank.filter((e) => !coreIds.has(e.id))]
    : shuffle(byRank.slice(0, Math.max(count * 6, 40)), rand);

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
  //
  // The search order is the pool's, not `byRank`'s, wherever the pool is
  // already the right shape: `byRank.find(isVerb)` returns the single lowest-
  // ranked verb every time, so at a beginner level every text opened by
  // teaching `ser` / `است` and never anything else.
  const nounCap = Math.max(1, Math.floor(count * MAX_NOUN_SHARE));
  const verbCap = Math.max(1, Math.floor(count * MAX_VERB_SHARE));
  const search = beginnerPool ? pool : byRank;
  for (const wanted of [isVerb, isModifier]) {
    if (picked.length >= count) break;
    let hit: LexiconEntry | undefined;
    if (wanted === isVerb && beginnerPool) {
      hit = search.find((e) => e.tags.includes("super-7") && !taken.has(e.id));
    }
    hit = hit ?? search.find((e) => wanted(e) && !taken.has(e.id)) ?? byRank.find(wanted);
    if (hit) add(hit);
  }

  for (const entry of pool) {
    if (picked.length >= count) break;
    if (isNoun(entry) && picked.filter(isNoun).length >= nounCap) continue;
    if (isVerb(entry) && picked.filter(isVerb).length >= verbCap) continue;
    add(entry);
  }

  // Both caps are a preference, not a hard limit: if honouring them would
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
 * The vocabulary a brand-new learner is given to build from.
 *
 * A learner with no history used to fall back to the sixty commonest words in
 * the language, which for Catalan is `de, ser, el, la, que, a, i, no, en, per`
 * and for Dari the equivalent. That is the worst possible starting vocabulary -
 * function words and abstractions, nothing picturable - and it is what every
 * new user got. The beginner core is the same size and is `gos, casa, poma,
 * taula, aigua, menjar`, so the first text a learner ever sees can be about
 * something.
 */
export function coldStartKnown(
  entries: readonly LexiconEntry[],
  level: Level,
  isUsable: (e: LexiconEntry) => boolean,
  size = 120,
): LexiconEntry[] {
  const core = entries.filter((e) => e.tags.includes(BEGINNER_CORE_TAG) && isUsable(e));
  const inBand = entries.filter((e) => level.freqBands.includes(e.freqBand) && isUsable(e));
  const byRank = (a: LexiconEntry, b: LexiconEntry) => a.freqRank - b.freqRank;
  // Above A1 the core is still a better opening than the raw frequency head,
  // but the level's own band has to lead or the text will not read at level.
  const head = isBeginnerLevel(level) ? [...core.sort(byRank), ...inBand.sort(byRank)] : [...inBand.sort(byRank), ...core.sort(byRank)];
  const seen = new Set<string>();
  const out: LexiconEntry[] = [];
  for (const e of head) {
    if (out.length >= size) break;
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out.sort(byRank);
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
  // Scaled to the level, but capped far below its vocabulary. Once `knownIds`
  // took over measurement the prompt no longer has to be exhaustive - it only
  // has to give the model enough to write with - and the list is the dominant
  // cost in every call. At 600 words it is 4.5k characters of Catalan and 9k of
  // Dari, sent again on every repair; three sequential calls per attempt put a
  // single active learner within reach of the whole daily free-tier quota, and
  // the Dari build exhausted it. Past a few hundred words the model stops
  // reading the list carefully anyway, so the tokens bought nothing.
  const budget = Math.max(120, Math.min(250, Math.round(level.entryKnownWords * 0.25) || 120));

  // At a beginner level the core comes first. Until this existed, only
  // `selectTargets` preferred it, so the model was told to *teach* `poma` and
  // `gos` while the vocabulary it could *build* from was headed by `de, ser,
  // el, la, que, estat, cosa, part, manera` - and the sentences came out
  // abstract no matter what was being taught. Both halves have to come from the
  // same pool. Sorting is stable, so within each group frequency still decides.
  const rank = (e: LexiconEntry) => {
    if (isBeginnerLevel(level) && e.tags.includes(BEGINNER_CORE_TAG)) {
      return e.freqRank - 1e6;
    }
    return e.freqRank;
  };
  const byRank = [...known].sort((a, b) => rank(a) - rank(b));
  if (!dueIds || dueIds.size === 0) return byRank.slice(0, budget);

  const due = byRank.filter((e) => dueIds.has(e.id));
  const rest = byRank.filter((e) => !dueIds.has(e.id));
  // Due words never take more than half the budget; the rest of the list still
  // has to be able to carry a coherent text.
  return [...due.slice(0, Math.floor(budget / 2)), ...rest].slice(0, budget);
}
