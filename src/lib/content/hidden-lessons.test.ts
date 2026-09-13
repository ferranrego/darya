import { describe, expect, it } from "vitest";

import { allGrammarLessons, grammarCourses, grammarLessonById, grammarLessons } from "./load.ts";

/**
 * A hidden lesson is off the course path but still a lesson. Both halves
 * matter: on the path it would block unlocks and keep a level from reading
 * complete; gone entirely it would orphan a learner's progress, their review
 * cards and every old link to it.
 */
describe("hidden grammar lessons", () => {
  const hidden = allGrammarLessons.filter((l) => l.hidden);

  it("stay off the map, the unlock order and the progress counts", () => {
    const onPath = new Set(
      grammarCourses.flatMap((c) => c.blocks.flatMap((b) => b.lessons.map((l) => l.id))),
    );
    for (const l of hidden) {
      expect(onPath.has(l.id), l.id).toBe(false);
      expect(grammarLessons.some((p) => p.id === l.id), l.id).toBe(false);
    }
  });

  it("still resolve by id, so their URL and review cards keep working", () => {
    for (const l of hidden) expect(grammarLessonById(l.id)?.id).toBe(l.id);
  });

  it("do not remove any visible lesson from the path", () => {
    expect(grammarLessons.length).toBe(allGrammarLessons.length - hidden.length);
  });
});
