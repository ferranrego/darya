import { describe, expect, it } from "vitest";

import { APP_TIMEZONE, localDate } from "./activity.ts";

/**
 * The day boundary used to be Barcelona midnight for every learner on earth,
 * so someone in Kabul lost their streak at half past two in the afternoon.
 * These pin the behaviour that fixes it, and the fallback that keeps existing
 * profiles exactly where they were.
 */
describe("the learner's own day", () => {
  // 21:30 UTC. Already tomorrow in Kabul (+4:30), still today in Madrid (+2).
  const evening = new Date("2026-09-11T21:30:00Z");

  it("rolls over at the learner's midnight, not the server's", () => {
    expect(localDate(evening, "Asia/Kabul")).toBe("2026-09-12");
    expect(localDate(evening, "Europe/Madrid")).toBe("2026-09-11");
  });

  it("puts a Kabul learner a day ahead of a Madrid one at that moment", () => {
    expect(localDate(evening, "Asia/Kabul")).not.toBe(localDate(evening, "Europe/Madrid"));
  });

  it("falls back to the app default when a profile has no timezone", () => {
    // Null is what every row predating the column holds, so this is the
    // guarantee that nothing shifted under anyone already using the app.
    expect(localDate(evening, null)).toBe(localDate(evening, APP_TIMEZONE));
  });

  it("survives a malformed timezone rather than breaking the daily counters", () => {
    expect(localDate(evening, "Not/AZone")).toBe(localDate(evening, APP_TIMEZONE));
  });

  it("formats as YYYY-MM-DD, which is what a Postgres date column expects", () => {
    expect(localDate(evening, "Asia/Kabul")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
