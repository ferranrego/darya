
/**
 * Resolving a lexeme id that may be personal.
 *
 * Since imported articles landed, `user_words.lexeme_id` holds two kinds of id:
 * `lx-` from the shipped lexicon, and `ux-` from the learner's own dictionary
 * (`public.user_lexemes`). Every call site that used to reach straight for
 * `lexemeById` has to decide which it means, and the two questions are genuinely
 * different:
 *
 *  - "show me this word"          -> entryFor (in `entry-for.ts`), which handles both
 *  - "how far through the course
 *     is this learner"            -> curricularKnownCount, which counts only the
 *                                    shipped lexicon
 *
 * The second one matters more than it looks: level thresholds in
 * docs/PEDAGOGY.md are counts against the frequency-ordered lexicon. Counting a
 * news article's vocabulary toward them promotes a learner for reading one hard
 * article, which is the opposite of what the number means.
 *
 * `entryFor` lives next door in `entry-for.ts` because it needs the lexicon,
 * and this module is imported by the app shell (the milestone observer, Home,
 * Stats). Importing the lexicon here put a 3.56 MB chunk on every page.
 */

export function isPersonalId(lexemeId: string): boolean {
  return lexemeId.startsWith("ux-");
}

/**
 * Known words that count toward CEFR level thresholds - i.e. excluding the
 * learner's personal dictionary. See the note above.
 */
export function curricularKnownCount(
  words: ReadonlyArray<{ lexeme_id: string; status: string }>,
): number {
  return words.filter((w) => w.status === "known" && !isPersonalId(w.lexeme_id)).length;
}
