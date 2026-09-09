import type { LexiconEntry } from "../content/schema";
import type { LexiconIndex } from "../lang/types";

export type { LexiconEntry };

/**
 * Just enough of a lexicon index to look a word up. Lets `segmentForHighlight`
 * accept the learner's personal dictionary without importing the whole
 * language-profile surface.
 */
export type LexiconIndexLike = Pick<LexiconIndex, "resolve" | "byId">;
