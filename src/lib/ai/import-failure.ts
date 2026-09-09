import { classifyAiFailure, type AiFailure } from "./failure.ts";

/**
 * What the import feature says when a model call fails.
 *
 * The wording exists here rather than in the component so the route can send a
 * reason code and the UI can render it without re-deriving anything, and so
 * that the two paths - translating a sentence, looking a word up - can differ
 * where they genuinely differ. "Try again in a moment" is only ever correct for
 * one of these five cases, and it was what all five said.
 */

export interface ImportFailure {
  reason: AiFailure;
  status: number;
  /** Ready to render. Says nothing about providers, models or status codes. */
  message: string;
}

const STATUS: Record<AiFailure, number> = {
  busy: 503,
  slow: 504,
  limit: 429,
  invalid: 422,
  failed: 502,
};

const TRANSLATION: Record<AiFailure, string> = {
  busy: "The translator has hit its daily limit. It resets within a day - the rest of the article still works.",
  slow: "That sentence took too long to translate. Open it again to retry.",
  limit: "You've translated a lot just now. Give it a minute.",
  // The one case where "try again" is a lie: the models answered, and their
  // answers kept failing validation. Retrying the same sentence does the same
  // thing.
  invalid: "This sentence came back garbled every time - it may be unusually long or badly formatted in the original.",
  failed: "Couldn't translate this sentence. Open it again to retry.",
};

const GLOSS: Record<AiFailure, string> = {
  busy: "The dictionary has hit its daily limit. It resets within a day.",
  slow: "That lookup took too long. Tap the word again.",
  limit: "You've looked up a lot of words just now. Give it a minute.",
  invalid: "Couldn't make sense of this word - it may be a typo, a foreign word, or a name.",
  failed: "Couldn't look this word up. Tap it again to retry.",
};

export function translationFailure(e: unknown): ImportFailure {
  const reason = classifyAiFailure(e);
  return { reason, status: STATUS[reason], message: TRANSLATION[reason] };
}

export function glossFailure(e: unknown): ImportFailure {
  const reason = classifyAiFailure(e);
  return { reason, status: STATUS[reason], message: GLOSS[reason] };
}
