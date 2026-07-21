import { describe, expect, it } from "vitest";
import { localDate } from "./activity";

describe("localDate", () => {
  it("rolls over at Barcelona midnight, not UTC midnight (summer, UTC+2)", () => {
    // 21:59 UTC on 15 July is still 23:59 on the 15th in Barcelona.
    expect(localDate(new Date("2026-07-15T21:59:00Z"))).toBe("2026-07-15");
    // 22:00 UTC is 00:00 on the 16th in Barcelona: a new day has started.
    expect(localDate(new Date("2026-07-15T22:00:00Z"))).toBe("2026-07-16");
  });

  it("rolls over at Barcelona midnight in winter (UTC+1)", () => {
    expect(localDate(new Date("2026-01-15T22:59:00Z"))).toBe("2026-01-15");
    expect(localDate(new Date("2026-01-15T23:00:00Z"))).toBe("2026-01-16");
  });

  it("does not advance the day just because UTC did", () => {
    // 00:30 UTC is still the previous evening in Barcelona? No: it is 01:30 or
    // 02:30 the same UTC date. The day must match Barcelona's calendar.
    expect(localDate(new Date("2026-07-16T00:30:00Z"))).toBe("2026-07-16");
  });

  it("formats as YYYY-MM-DD with zero padding", () => {
    expect(localDate(new Date("2026-03-05T12:00:00Z"))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(localDate(new Date("2026-03-05T12:00:00Z"))).toBe("2026-03-05");
  });
});
