import { describe, expect, it } from "vitest";
import {
  importedDocumentSchema,
  textDocumentSchema,
  userLexemeSchema,
} from "./schema.ts";

const doc = {
  id: "tx-imp-abc",
  formatVersion: "1.5.0",
  titleTarget: "T",
  titleEn: "T",
  sentences: [{ target: "a b", en: "", tokens: [{ surface: "a", lexemeId: null }] }],
  vocabUsed: [],
  oovSurfaces: ["a"],
  newWordRatio: 0.5,
  source: "imported" as const,
  sourceUrl: null,
  createdAt: "2026-09-09T00:00:00.000Z",
};

describe("importedDocumentSchema", () => {
  it("accepts an untranslated sentence", () => {
    expect(importedDocumentSchema.safeParse(doc).success).toBe(true);
  });

  it("accepts an untranslated title", () => {
    expect(importedDocumentSchema.safeParse({ ...doc, titleEn: "" }).success).toBe(true);
  });

  it("accepts a proper-noun token", () => {
    const withName = structuredClone(doc);
    withName.sentences[0].tokens[0] = {
      surface: "a",
      lexemeId: null,
      kind: "name",
    } as (typeof withName.sentences)[0]["tokens"][0];
    expect(importedDocumentSchema.safeParse(withName).success).toBe(true);
  });
});

/**
 * The structural guarantee behind keeping imports out of `public.texts`: that
 * table's rows feed the pool every learner reads from, so an imported article
 * must not even be expressible as a TextDocument. If this test ever goes green
 * for the wrong reason, one learner's article can reach everybody's queue.
 */
describe("textDocumentSchema", () => {
  it("rejects source: imported", () => {
    const asCurriculum = {
      ...doc,
      level: "L1",
      sentences: [{ target: "a b", en: "x", tokens: [{ surface: "a", lexemeId: null }] }],
      newWords: [],
    };
    expect(textDocumentSchema.safeParse(asCurriculum).success).toBe(false);
  });

  it("rejects an empty English translation", () => {
    const untranslated = {
      ...doc,
      level: "L1",
      source: "generated",
      newWords: [],
    };
    expect(textDocumentSchema.safeParse(untranslated).success).toBe(false);
  });
});

describe("userLexemeSchema", () => {
  it("requires the ux- namespace", () => {
    const entry = {
      id: "lx-0001",
      target: "x",
      targetNormalized: "x",
      glossEn: "x",
      pos: "noun",
      variants: [],
    };
    expect(userLexemeSchema.safeParse(entry).success).toBe(false);
    expect(userLexemeSchema.safeParse({ ...entry, id: "ux-0a1b2c3d" }).success).toBe(true);
  });
});
