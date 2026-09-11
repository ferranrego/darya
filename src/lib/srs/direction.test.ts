import { describe, expect, it } from "vitest";
import { State, type Card } from "ts-fsrs";

import { defaultInputMode, directionFor, PRODUCTION_AFTER_REVIEWS } from "./direction.ts";
import { newCard } from "./scheduler.ts";

function cardIn(state: State, reps: number): Card {
  return { ...newCard(new Date("2026-09-11T00:00:00Z")), state, reps };
}

describe("which way round a card is asked", () => {
  it("never demands a brand new word back", () => {
    // A word met once and immediately demanded is a test of the last ten
    // seconds, and failing it teaches only that the app is unfair.
    expect(directionFor(cardIn(State.New, 0), 0, 0)).toBe("recognition");
    expect(directionFor(cardIn(State.Learning, 1), 0, 0)).toBe("recognition");
  });

  it("waits for a couple of successful recognitions first", () => {
    expect(directionFor(cardIn(State.Review, PRODUCTION_AFTER_REVIEWS - 1), 0, 0)).toBe("recognition");
    expect(directionFor(cardIn(State.Review, PRODUCTION_AFTER_REVIEWS), 0, 0)).toBe("production");
  });

  it("keeps asking until the word has been written once", () => {
    // This is the evidence "known" is about to require, so it cannot be
    // skipped by a run of lucky recognitions.
    const card = cardIn(State.Review, 5);
    for (const seed of [0, 1, 2, 3, 7, 100]) {
      expect(directionFor(card, 0, seed), `seed ${seed}`).toBe("production");
    }
  });

  it("alternates once the word has been produced, rather than never asking again", () => {
    const card = cardIn(State.Review, 5);
    const directions = [0, 1, 2, 3].map((seed) => directionFor(card, 1, seed));
    expect(new Set(directions).size).toBe(2);
  });

  it("treats a relearning word as a recognition problem", () => {
    // A lapsed word has just been forgotten; asking for production on the spot
    // is the same unfairness as asking for a brand new one.
    expect(directionFor(cardIn(State.Relearning, 9), 3, 0)).toBe("recognition");
  });
});

describe("how the answer is given", () => {
  it("offers tiles to beginners, who may not have a Dari keyboard at all", () => {
    expect(defaultInputMode("L1")).toBe("tiles");
    expect(defaultInputMode("L2")).toBe("tiles");
  });

  it("switches to typing from the third level", () => {
    for (const level of ["L3", "L4", "L5"]) {
      expect(defaultInputMode(level), level).toBe("typing");
    }
  });

  it("falls back to typing when the level is unknown rather than guessing beginner", () => {
    expect(defaultInputMode(null)).toBe("typing");
    expect(defaultInputMode(undefined)).toBe("typing");
  });
});
