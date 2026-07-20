import { describe, expect, it } from "vitest";
import { State } from "ts-fsrs";
import { isGraduated, newCard, reviewCard } from "./scheduler.ts";

describe("srs scheduler", () => {
  it("maps 'got it' to a longer interval than 'forgot'", () => {
    const now = new Date("2026-07-20T10:00:00Z");
    const card = newCard(now);
    const good = reviewCard(card, "got_it", now).card;
    const again = reviewCard(card, "forgot", now).card;
    expect(good.due.getTime()).toBeGreaterThan(again.due.getTime());
  });

  it("produces a review log with a rating for each answer", () => {
    const now = new Date("2026-07-20T10:00:00Z");
    const { log } = reviewCard(newCard(now), "got_it", now);
    expect(log.rating).toBeGreaterThan(0);
  });

  it("does not graduate a freshly-seen word", () => {
    const now = new Date("2026-07-20T10:00:00Z");
    const { card } = reviewCard(newCard(now), "got_it", now);
    expect(isGraduated(card)).toBe(false);
  });

  it("graduates once a review-state card passes the stability threshold", () => {
    const graduated = {
      state: State.Review,
      stability: 30,
      due: new Date(),
    } as Parameters<typeof isGraduated>[0];
    expect(isGraduated(graduated)).toBe(true);
  });
});
