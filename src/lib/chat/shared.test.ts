import { describe, expect, it } from "vitest";
import { startsGroup } from "./shared.ts";

const at = (minutes: number) => new Date(Date.UTC(2026, 6, 21, 12, minutes)).toISOString();
const msg = (user_id: string, minutes: number) => ({ user_id, created_at: at(minutes) });

describe("startsGroup", () => {
  it("starts a group when there is no previous message", () => {
    expect(startsGroup(msg("a", 0))).toBe(true);
  });

  it("continues the group for the same sender within the gap", () => {
    expect(startsGroup(msg("a", 5), msg("a", 0))).toBe(false);
  });

  it("starts a new group when the same sender returns after a long pause", () => {
    expect(startsGroup(msg("a", 20), msg("a", 0))).toBe(true);
  });

  it("starts a new group whenever the sender changes, however quick the reply", () => {
    expect(startsGroup(msg("b", 1), msg("a", 0))).toBe(true);
  });

  it("treats exactly the gap length as still the same group", () => {
    expect(startsGroup(msg("a", 15), msg("a", 0))).toBe(false);
  });
});
