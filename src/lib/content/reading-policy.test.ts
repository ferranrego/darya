import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { reReadCandidates, translitPolicy } from "./reading-policy.ts";
import { textDocumentSchema, type TextDocument } from "./schema.ts";

function seedDocs(): TextDocument[] {
  const dir = join(process.cwd(), "content", "prs", "texts", "seed");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => textDocumentSchema.parse(JSON.parse(readFileSync(join(dir, f), "utf8"))));
}

describe("fading the pronunciation line", () => {
  it("never takes it away, at any level", () => {
    // With no audio, this line is the entire pronunciation of the language.
    // "Hidden" still means one tap away; there is no level where it is gone.
    for (const level of ["L1", "L2", "L3", "L4", "L5", null, undefined]) {
      expect(["always", "on-tap", "hidden"]).toContain(translitPolicy(level));
    }
  });

  it("leaves it on for a learner who may not read the script at all", () => {
    expect(translitPolicy("L1")).toBe("always");
  });

  it("fades it rather than switching it off in one step", () => {
    expect(translitPolicy("L2")).toBe("on-tap");
    expect(translitPolicy("L3")).toBe("hidden");
  });

  it("treats an unknown level as advanced, not as beginner", () => {
    // An imported article has no level. Defaulting to "always" would hand a
    // permanent crutch to exactly the learner who imports their own reading.
    expect(translitPolicy(null)).toBe("hidden");
  });
});

describe("bringing a text back", () => {
  const docs = seedDocs();
  const now = new Date("2026-09-11T00:00:00Z");
  const longAgo = "2026-08-01T00:00:00Z";
  const yesterday = "2026-09-10T00:00:00Z";

  it("offers a text whose words are due again", () => {
    const doc = docs.find((d) => d.vocabUsed.length >= 10)!;
    const due = new Set(doc.vocabUsed.slice(0, 5));
    const out = reReadCandidates({ read: [{ doc, readAt: longAgo }], dueLexemeIds: due, now, limit: 5 });
    expect(out).toHaveLength(1);
    expect(out[0].dueWords).toBe(5);
  });

  it("does not offer something finished yesterday", () => {
    // That is rereading, not re-exposure.
    const doc = docs.find((d) => d.vocabUsed.length >= 10)!;
    const due = new Set(doc.vocabUsed);
    expect(reReadCandidates({ read: [{ doc, readAt: yesterday }], dueLexemeIds: due, now, limit: 5 })).toEqual([]);
  });

  it("does not offer a text with almost nothing due in it", () => {
    const doc = docs.find((d) => d.vocabUsed.length >= 10)!;
    const due = new Set(doc.vocabUsed.slice(0, 1));
    expect(reReadCandidates({ read: [{ doc, readAt: longAgo }], dueLexemeIds: due, now, limit: 5 })).toEqual([]);
  });

  it("puts the text with the most due words first", () => {
    const [a, b] = docs.filter((d) => d.vocabUsed.length >= 10).slice(0, 2);
    const due = new Set([...a.vocabUsed.slice(0, 4), ...b.vocabUsed.slice(0, 9)]);
    const out = reReadCandidates({
      read: [{ doc: a, readAt: longAgo }, { doc: b, readAt: longAgo }],
      dueLexemeIds: due,
      now,
      limit: 5,
    });
    expect(out[0].doc.id).toBe(b.id);
  });

  it("offers nothing when nothing is due, rather than filling the screen", () => {
    expect(
      reReadCandidates({ read: docs.map((d) => ({ doc: d, readAt: longAgo })), dueLexemeIds: new Set(), now, limit: 5 }),
    ).toEqual([]);
  });
});
