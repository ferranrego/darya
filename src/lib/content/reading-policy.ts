/**
 * How much help a reader gets, and when a text comes back.
 *
 * Two small rules that together raise exposure without a single new sentence
 * being written - which matters, because the beginner course shows 51% of its
 * words exactly once and rewriting it is a much larger job than either of
 * these.
 */
import type { TextDocument } from "./schema.ts";

/** What the reader shows under each sentence. */
export type TranslitPolicy = "always" | "on-tap" | "hidden";

/**
 * The Latin pronunciation line, faded by level.
 *
 * With no audio anywhere in the app, this line is the entire pronunciation of
 * the language, so it can never be removed - a learner who cannot sound a word
 * out has no other route to it. But left as one on/off switch it is never put
 * down either, and the Afghan script never becomes the way a learner actually
 * reads. Fading is the only mechanism a text-only app has for that.
 *
 * Always at the first level, where a learner may not read the script at all.
 * On tap at the second, so it is there the moment it is wanted and absent the
 * rest of the time. Hidden by default above that, still one tap away - never
 * gone, because "never gone" is the promise that makes the fading acceptable.
 */
export function translitPolicy(level: string | null | undefined): TranslitPolicy {
  if (level === "L1") return "always";
  if (level === "L2") return "on-tap";
  return "hidden";
}

/** A text worth reading again, and why it came back. */
export interface ReReadCandidate {
  doc: TextDocument;
  /** Words in it that are due for review right now. */
  dueWords: number;
  /** When it was last read. */
  readAt: string;
}

/** Below this a re-read is not worth offering - one due word is not a reason. */
const MIN_DUE_WORDS = 3;
/** Rereading something finished yesterday is rereading, not re-exposure. */
const MIN_DAYS_SINCE_READ = 7;

/**
 * Texts worth returning to.
 *
 * Re-reading is one of the cheapest and best-evidenced ways to build reading
 * fluency, and the app has never offered it: every text is read once and
 * abandoned, while the words in it go into a review deck as isolated cards.
 * Bringing a text back when its words are due is the same repetition the SRS
 * is already asking for, in the form the app is actually good at - and the
 * text is already written, so it costs nothing at all.
 *
 * Sorted by how much is due rather than by age: the point is the words, not
 * the nostalgia.
 */
export function reReadCandidates(input: {
  read: readonly { doc: TextDocument; readAt: string }[];
  /** Lexeme ids due for review right now. */
  dueLexemeIds: ReadonlySet<string>;
  now: Date;
  limit: number;
}): ReReadCandidate[] {
  const { read, dueLexemeIds, now, limit } = input;
  const cutoff = now.getTime() - MIN_DAYS_SINCE_READ * 24 * 60 * 60 * 1000;

  return read
    .filter((r) => new Date(r.readAt).getTime() <= cutoff)
    .map((r) => ({
      doc: r.doc,
      readAt: r.readAt,
      dueWords: new Set(r.doc.vocabUsed.filter((id) => dueLexemeIds.has(id))).size,
    }))
    .filter((c) => c.dueWords >= MIN_DUE_WORDS)
    .sort((a, b) => b.dueWords - a.dueWords || a.readAt.localeCompare(b.readAt))
    .slice(0, limit);
}
