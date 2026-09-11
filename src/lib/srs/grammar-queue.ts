/**
 * Grammar that comes back.
 *
 * Ninety-three lessons and 589 written exercises, and completing a lesson once
 * marked it done forever - no review, no repetition, nothing that brings the
 * point back a week later. Vocabulary has had a scheduler since the first
 * migration; grammar had a checkbox.
 *
 * Two things make this cost nothing. The card is the grammar point, not the
 * exercise, so one lesson is one thing to remember rather than twelve. And the
 * question is drawn from that lesson's own written exercises, which already
 * exist and have already been reviewed - where today's "extra practice" button
 * is a model call against a quota shared by every learner of the deployment.
 *
 * The scheduler itself is untouched and shared with vocabulary, deliberately:
 * two schedulers would become two different ideas of when something is due.
 */
import type { Card } from "ts-fsrs";

import type { GrammarExercise, GrammarLesson } from "../content/schema";

/** One grammar point due for review, and the question to ask it with. */
export interface GrammarReviewItem {
  lessonId: string;
  lessonTitle: string;
  grammarPoint: string;
  exercise: GrammarExercise;
}

export interface GrammarCardRow {
  lesson_id: string;
  due: string | null;
  fsrs: Card | null;
}

/**
 * Exercise types that can be asked cold, a week after the lesson.
 *
 * `matchPairs` is excluded: it is a whole-screen sorting task built to
 * consolidate a lesson just taught, and dropping one into a mixed daily queue
 * makes a two-minute exercise out of a ten-second one. `spotError` is kept -
 * its sentence is wrong on purpose, which the validators already know.
 */
const REVIEWABLE_TYPES = new Set(["fillBlank", "buildSentence", "chooseTranslation", "spotError"]);

/**
 * Pick the grammar items due now.
 *
 * `rand` decides which of a lesson's exercises is asked, so the same point
 * comes back in a different shape rather than as the same question each time -
 * which is re-exposure rather than memorising one item.
 */
export function dueGrammarItems(input: {
  cards: readonly GrammarCardRow[];
  lessons: readonly GrammarLesson[];
  now: Date;
  limit: number;
  rand: () => number;
}): GrammarReviewItem[] {
  const { cards, lessons, now, limit, rand } = input;
  const byId = new Map(lessons.map((l) => [l.id, l]));

  const due = cards
    .filter((c) => c.due !== null && new Date(c.due) <= now)
    // Most overdue first: a point forgotten three weeks ago is more urgent
    // than one due this morning.
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""));

  const out: GrammarReviewItem[] = [];
  for (const card of due) {
    if (out.length >= limit) break;
    const lesson = byId.get(card.lesson_id);
    // A card whose lesson no longer exists - renamed or removed by a content
    // edit - must not strand the queue. Skipped rather than shown empty.
    if (!lesson) continue;
    const usable = lesson.exercises.filter((e) => REVIEWABLE_TYPES.has(e.type));
    if (usable.length === 0) continue;
    out.push({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      grammarPoint: lesson.grammarPoint,
      exercise: usable[Math.floor(rand() * usable.length) % usable.length],
    });
  }
  return out;
}

/**
 * How grammar items are spread through a session of word cards.
 *
 * Interleaved rather than appended. A block of grammar at the end is a block a
 * learner stops reaching - which is how grammar became an island in the first
 * place - and alternating two kinds of recall is better practice than doing
 * each in a run.
 */
export function interleave<W, G>(words: readonly W[], grammar: readonly G[]): (W | G)[] {
  if (grammar.length === 0) return [...words];
  if (words.length === 0) return [...grammar];
  const out: (W | G)[] = [...words];
  const every = Math.max(2, Math.floor(words.length / (grammar.length + 1)) + 1);
  grammar.forEach((item, i) => {
    const at = Math.min(out.length, (i + 1) * every + i);
    out.splice(at, 0, item);
  });
  return out;
}
