import { describe, expect, it } from "vitest";

import { grammarLessons } from "../content/load.ts";
import { dueGrammarItems, interleave, type GrammarCardRow } from "./grammar-queue.ts";
import { newCard } from "./scheduler.ts";

/**
 * Run against the real grammar course, not fixtures.
 *
 * The claim is that grammar review costs no model call because the 589 written
 * exercises already exist. That is only true if every lesson actually has an
 * exercise that can be asked cold - so this checks the shipped course rather
 * than a handmade lesson that obviously does.
 */
function rand() {
  let s = 11;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const NOW = new Date("2026-09-11T12:00:00Z");

function card(lessonId: string, dueAt: string | null): GrammarCardRow {
  return { lesson_id: lessonId, due: dueAt, fsrs: newCard(NOW) };
}

describe("grammar review drawn from the course's own exercises", () => {
  it("can ask a question about every lesson the course ships", () => {
    const cards = grammarLessons.map((l) => card(l.id, "2026-09-01T00:00:00Z"));
    const items = dueGrammarItems({
      cards,
      lessons: grammarLessons,
      now: NOW,
      limit: grammarLessons.length,
      rand: rand(),
    });
    const covered = new Set(items.map((i) => i.lessonId));
    const missing = grammarLessons.filter((l) => !covered.has(l.id));
    if (missing.length > 0) {
      console.log(`no reviewable exercise: ${missing.slice(0, 10).map((l) => l.id).join(", ")}`);
    }
    console.log(`grammar lessons reviewable with no model call: ${covered.size} of ${grammarLessons.length}`);
    expect(missing).toHaveLength(0);
  });

  it("asks the same point in a different shape on a later review", () => {
    // Re-exposure, not memorising one item. Only asserted for lessons that
    // actually have more than one reviewable exercise.
    const lesson = grammarLessons.find(
      (l) => l.exercises.filter((e) => e.type !== "matchPairs").length > 1,
    )!;
    const shapes = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      let s = seed * 7919 + 1;
      const items = dueGrammarItems({
        cards: [card(lesson.id, "2026-09-01T00:00:00Z")],
        lessons: grammarLessons,
        now: NOW,
        limit: 1,
        rand: () => {
          s = (s * 1664525 + 1013904223) % 4294967296;
          return s / 4294967296;
        },
      });
      shapes.add(JSON.stringify(items[0]?.exercise));
    }
    expect(shapes.size).toBeGreaterThan(1);
  });

  it("never offers a match-pairs exercise as a daily review item", () => {
    // A whole-screen sorting task built to consolidate a lesson just taught.
    // In a mixed queue it turns a ten-second item into a two-minute one.
    const cards = grammarLessons.map((l) => card(l.id, "2026-09-01T00:00:00Z"));
    const items = dueGrammarItems({ cards, lessons: grammarLessons, now: NOW, limit: 500, rand: rand() });
    expect(items.some((i) => i.exercise.type === "matchPairs")).toBe(false);
  });

  it("leaves out what is not due yet", () => {
    const cards = [card(grammarLessons[0].id, "2026-10-01T00:00:00Z"), card(grammarLessons[1].id, null)];
    expect(dueGrammarItems({ cards, lessons: grammarLessons, now: NOW, limit: 10, rand: rand() })).toEqual([]);
  });

  it("takes the most overdue first", () => {
    const cards = [
      card(grammarLessons[2].id, "2026-09-11T00:00:00Z"),
      card(grammarLessons[0].id, "2026-06-01T00:00:00Z"),
    ];
    const items = dueGrammarItems({ cards, lessons: grammarLessons, now: NOW, limit: 1, rand: rand() });
    expect(items[0].lessonId).toBe(grammarLessons[0].id);
  });

  it("skips a card whose lesson no longer exists rather than stranding the queue", () => {
    const cards = [card("gl-99", "2026-01-01T00:00:00Z"), card(grammarLessons[0].id, "2026-01-01T00:00:00Z")];
    const items = dueGrammarItems({ cards, lessons: grammarLessons, now: NOW, limit: 10, rand: rand() });
    expect(items).toHaveLength(1);
    expect(items[0].lessonId).toBe(grammarLessons[0].id);
  });
});

describe("mixing grammar into the word queue", () => {
  it("keeps every item, and adds none", () => {
    const words = ["w1", "w2", "w3", "w4", "w5", "w6"];
    const grammar = ["g1", "g2"];
    const mixed = interleave(words, grammar);
    expect(mixed).toHaveLength(words.length + grammar.length);
    expect(new Set(mixed).size).toBe(mixed.length);
  });

  it("does not leave grammar in a block at the end", () => {
    // A block at the end is a block a learner stops reaching, which is how
    // grammar became an island in the first place.
    const words = Array.from({ length: 12 }, (_, i) => `w${i}`);
    const grammar = ["g1", "g2", "g3"];
    const mixed = interleave(words, grammar);
    const positions = grammar.map((g) => mixed.indexOf(g));
    expect(Math.min(...positions)).toBeLessThan(words.length / 2);
    expect(positions[0]).toBeGreaterThan(0);
  });

  it("copes with either side being empty", () => {
    expect(interleave([], ["g1"])).toEqual(["g1"]);
    expect(interleave(["w1"], [])).toEqual(["w1"]);
    expect(interleave([], [])).toEqual([]);
  });
});
