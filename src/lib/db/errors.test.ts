import { describe, expect, it } from "vitest";

import { buildErrorRow } from "./errors.ts";

/**
 * Supabase is production-only here, so there is no database to test against -
 * which is exactly why the row builder is a pure function. What these assert
 * is the part that would otherwise only be discovered in production: that the
 * shape matches the columns, and that absent fields become null rather than
 * `undefined`, which PostgREST would drop from the payload entirely.
 */
describe("buildErrorRow", () => {
  it("keeps the token that was wrong, not a whole sentence", () => {
    const row = buildErrorRow("u1", {
      kind: "chat",
      given: "مدرسه",
      expected: "مکتب",
      whyEn: "In Afghanistan a school is مکتب; مدرسه is a madrassa.",
    });
    expect(row.given).toBe("مدرسه");
    expect(row.expected).toBe("مکتب");
    // What the learner wrote is stored as the token that was wrong, not as the
    // sentence around it, so the 48h chat purge keeps its meaning. `why_en` is
    // the app's own explanation and may be a full sentence.
    expect(row.given!.split(/\s+/)).toHaveLength(1);
    expect(row.expected!.split(/\s+/)).toHaveLength(1);
  });

  it("writes null, not undefined, for the fields a mistake does not have", () => {
    const row = buildErrorRow("u1", { kind: "srs", lexemeId: "lx-0001" });
    // PostgREST omits undefined keys, which would leave the column at its
    // default instead of null and make "no grammar point" indistinguishable
    // from "not recorded".
    for (const [key, value] of Object.entries(row)) {
      expect(value, `${key} must not be undefined`).not.toBe(undefined);
    }
    expect(row.grammar_point).toBeNull();
    expect(row.item_id).toBeNull();
  });

  it("carries the user id it was given", () => {
    expect(buildErrorRow("abc", { kind: "exercise" }).user_id).toBe("abc");
  });

  it("uses the kinds the database check constraint allows", () => {
    const allowed = ["srs", "exercise", "grammar", "chat", "interference", "comprehension"];
    for (const kind of allowed) {
      expect(buildErrorRow("u", { kind: kind as never }).kind).toBe(kind);
    }
  });
});
