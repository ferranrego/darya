import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { GRAMMAR_LEVEL_ORDER, buildJourneyNodes, cefrOf } from "./cefr.ts";
import { grammarCoursesFileSchema, levelsFileSchema, type Level } from "./schema.ts";

/**
 * The reading level a learner is placed at decides which grammar course they
 * are given, and the two ladders are not the same shape in the two languages.
 * Catalan has a pre-A1 warm-up and an A2+ consolidation step; Dari has neither.
 * A mapping written for one is wrong for the other, which is how a Catalan
 * learner assessed at B2 was started on C1 and never saw the B2 course.
 */

const LANGS = ["ca", "prs"] as const;

function load(lang: string) {
  const root = join(import.meta.dirname, "..", "..", "..", "content", lang);
  const levels = levelsFileSchema.parse(
    JSON.parse(readFileSync(join(root, "levels", "levels.json"), "utf8")),
  ).levels;
  const courses = grammarCoursesFileSchema.parse(
    JSON.parse(readFileSync(join(root, "grammar", "all.json"), "utf8")),
  ).courses;
  return { levels, courses };
}

describe("cefrOf", () => {
  const at = (cefrHint: string): Level =>
    ({ id: "L1", name: "x", cefrHint, freqBands: [1], entryKnownWords: 0,
       sentenceRange: [2, 3], sentenceLengthHint: "max 7 words", avgSentenceWords: 5,
       grammarAllowed: [] }) as Level;

  it("collapses the finer reading labels onto the course that exists", () => {
    expect(cefrOf(at("pre-A1"))).toBe("A1");
    expect(cefrOf(at("A2+"))).toBe("A2");
    expect(cefrOf(at("B1"))).toBe("B1");
  });

  it("refuses a hint that is not a CEFR level rather than guessing", () => {
    // Silently defaulting is what let the old switch send Catalan B2 learners
    // to C1; a level with a typo'd hint should fail loudly at startup.
    expect(() => cefrOf(at("Intermediate"))).toThrow(/not a CEFR level/);
  });
});

describe.each(LANGS)("%s journey", (lang) => {
  const { levels, courses } = load(lang);
  const nodes = buildJourneyNodes(levels);

  it("emits exactly one node per shipped reading level", () => {
    expect(nodes.map((n) => n.levelId)).toEqual(levels.map((l) => l.id));
  });

  it("maps every level onto a grammar course that ships", () => {
    const shipped = new Set(courses.map((c) => c.level));
    for (const node of nodes) {
      expect(shipped.has(node.grammar), `${node.levelId} → ${node.grammar} has no course`).toBe(true);
    }
  });

  it("never offers the same grammar course twice", () => {
    const owned = nodes.filter((n) => n.ownsGrammar).map((n) => n.grammar);
    expect(owned).toEqual([...new Set(owned)]);
  });

  it("advances through the CEFR courses without going backwards", () => {
    const idx = nodes.map((n) => GRAMMAR_LEVEL_ORDER.indexOf(n.grammar));
    for (let i = 1; i < idx.length; i++) {
      expect(idx[i], `${nodes[i].levelId} regresses to ${nodes[i].grammar}`).toBeGreaterThanOrEqual(idx[i - 1]);
    }
  });

  it("puts a level labelled B2 on the B2 course", () => {
    // The specific regression: Catalan L6 is B2 and used to be sent to C1.
    for (const node of nodes) {
      if (node.cefrHint === "B2") expect(node.grammar).toBe("B2");
      if (node.cefrHint === "B1") expect(node.grammar).toBe("B1");
    }
  });
});
