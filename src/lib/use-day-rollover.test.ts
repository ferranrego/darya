import { describe, expect, it } from "vitest";
import { msUntilNextBarcelonaMidnight } from "./use-day-rollover";

const HOUR = 60 * 60 * 1000;

describe("msUntilNextBarcelonaMidnight", () => {
  it("targets 22:00 UTC in summer (Barcelona is UTC+2)", () => {
    // 20:00 UTC on 15 July → Barcelona 22:00 → 2h until midnight.
    expect(msUntilNextBarcelonaMidnight(new Date("2026-07-15T20:00:00Z"))).toBe(2 * HOUR);
  });

  it("targets 23:00 UTC in winter (Barcelona is UTC+1)", () => {
    // 20:00 UTC on 15 January → Barcelona 21:00 → 3h until midnight.
    expect(msUntilNextBarcelonaMidnight(new Date("2026-01-15T20:00:00Z"))).toBe(3 * HOUR);
  });

  it("is a full day right after midnight", () => {
    // 22:00 UTC on 15 July IS Barcelona midnight on the 16th.
    expect(msUntilNextBarcelonaMidnight(new Date("2026-07-15T22:00:00Z"))).toBe(24 * HOUR);
  });

  it("never returns more than 25h or a non-positive value", () => {
    // Sweep a year in 6h steps, crossing both DST transitions.
    for (let t = Date.parse("2026-01-01T00:00:00Z"); t < Date.parse("2027-01-01T00:00:00Z"); t += 6 * HOUR) {
      const ms = msUntilNextBarcelonaMidnight(new Date(t));
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(25 * HOUR);
    }
  });
});
