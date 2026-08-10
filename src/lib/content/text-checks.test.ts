import { describe, expect, it } from "vitest";
import { profile } from "../lang/index.ts";
import {
  checkCohesion,
  checkCoverage,
  checkGloss,
  checkInterference,
  checkTeaching,
} from "./text-checks.ts";
import { CONTENT_FORMAT_VERSION, type TextDocument, type Token } from "./schema.ts";
import { lexicon, levels } from "./load.ts";

const l1 = levels[0];

/** A minimally valid TextDocument, so each test only has to override what it's testing. */
function doc(overrides: Partial<TextDocument> & { sentences: TextDocument["sentences"] }): TextDocument {
  return {
    id: "tx-test",
    formatVersion: CONTENT_FORMAT_VERSION,
    level: l1.id,
    titleTarget: "test",
    titleEn: "test",
    vocabUsed: [],
    newWords: [],
    newWordRatio: 0,
    source: "generated",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const tok = (surface: string, lexemeId: string | null): Token => ({ surface, lexemeId });

describe(`${profile.code} text-checks`, () => {
  describe("checkCoverage", () => {
    it("passes when every vocabUsed id is allowed", () => {
      const d = doc({
        sentences: [{ target: "x", en: "x.", tokens: [tok("x", "lx-0001")] }],
        vocabUsed: ["lx-0001"],
      });
      expect(checkCoverage(d, l1, ["lx-0001", "lx-0002"])).toEqual([]);
    });

    it("rejects a word outside the allowed set", () => {
      const d = doc({
        sentences: [{ target: "x", en: "x.", tokens: [tok("x", "lx-9999")] }],
        vocabUsed: ["lx-0001", "lx-9999"],
      });
      const defects = checkCoverage(d, l1, new Set(["lx-0001"]));
      expect(defects).toHaveLength(1);
      expect(defects[0].severity).toBe("reject");
      expect(defects[0].message).toContain("lx-9999");
    });
  });

  describe("checkTeaching", () => {
    it("passes when every assigned word appears at least once", () => {
      // PEDAGOGY §7's 6-12 encounters accumulate across the SRS/reuse loop,
      // not within one text - see the comment on MIN_OCCURRENCES_PER_TAUGHT_WORD.
      const d = doc({
        sentences: [{ target: "a b", en: "a b.", tokens: [tok("a", "lx-0001"), tok("b", "lx-0002")] }],
      });
      expect(checkTeaching(d, ["lx-0001", "lx-0002"])).toEqual([]);
    });

    it("rejects an assigned word that never appears", () => {
      const d = doc({
        sentences: [{ target: "a", en: "a.", tokens: [tok("a", "lx-0001")] }],
      });
      const defects = checkTeaching(d, ["lx-0001", "lx-0002"]);
      expect(defects).toHaveLength(1);
      expect(defects[0].severity).toBe("reject");
      expect(defects[0].message).toContain("lx-0002 (0x)");
      expect(defects[0].message).not.toContain("lx-0001");
    });
  });

  describe("checkGloss", () => {
    it("passes a real sentence translation", () => {
      const d = doc({ sentences: [{ target: "x", en: "The tea is hot.", tokens: [tok("x", null)] }] });
      expect(checkGloss(d)).toEqual([]);
    });

    it("flags an empty translation", () => {
      const d = doc({ sentences: [{ target: "x", en: " ", tokens: [tok("x", null)] }] });
      const defects = checkGloss(d);
      expect(defects).toHaveLength(1);
      expect(defects[0].severity).toBe("flag");
    });

    it("flags a translation identical to the target text", () => {
      const d = doc({ sentences: [{ target: "چای گرم است", en: "چای گرم است", tokens: [tok("x", null)] }] });
      expect(checkGloss(d)).toHaveLength(1);
    });

    it("flags a bare multi-sense gloss standing in for a sentence", () => {
      const d = doc({ sentences: [{ target: "x", en: "land, ground, earth", tokens: [tok("x", null)] }] });
      const defects = checkGloss(d);
      expect(defects).toHaveLength(1);
      expect(defects[0].kind).toBe("gloss");
    });

    it("does not flag a real sentence that happens to contain a comma", () => {
      const d = doc({
        sentences: [{ target: "x", en: "I have a house, and I like it.", tokens: [tok("x", null)] }],
      });
      expect(checkGloss(d)).toEqual([]);
    });
  });

  describe("checkCohesion", () => {
    it("passes when a sentence shares a lexeme with the previous one", () => {
      const d = doc({
        sentences: [
          { target: "a", en: "a.", tokens: [tok("a", "lx-0001")] },
          { target: "a b", en: "a b.", tokens: [tok("a", "lx-0001"), tok("b", "lx-0002")] },
        ],
      });
      expect(checkCohesion(d)).toEqual([]);
    });

    it("passes when a sentence picks the topic up with a pronoun", () => {
      const pronoun = lexicon.entries.find((e) => e.pos === "pronoun");
      expect(pronoun, "fixture needs at least one pronoun entry in the active lexicon").toBeDefined();
      const d = doc({
        sentences: [
          { target: "a", en: "a.", tokens: [tok("a", "lx-0001")] },
          // No shared lexeme id with the previous sentence - cohesion has to
          // come from the pronoun in the target text, which is what
          // checkCohesion actually scans (see ANAPHORS in text-checks.ts).
          { target: `${pronoun!.target} b`, en: "p b.", tokens: [tok("b", "lx-9998")] },
        ],
      });
      expect(checkCohesion(d)).toEqual([]);
    });

    it("flags a sentence sharing nothing with its predecessor", () => {
      const d = doc({
        sentences: [
          { target: "a", en: "a.", tokens: [tok("a", "lx-0001")] },
          { target: "z", en: "z.", tokens: [tok("z", "lx-9999")] },
        ],
      });
      const defects = checkCohesion(d);
      expect(defects).toHaveLength(1);
      expect(defects[0].severity).toBe("flag");
      expect(defects[0].message).toContain("#1");
    });
  });

  describe.skipIf(profile.code !== "ca")("checkInterference (ca)", () => {
    it("passes idiomatic Catalan", () => {
      const d = doc({
        sentences: [
          { target: "Hi ha molts llibres a casa.", en: "There are many books at home.", tokens: [] },
        ],
      });
      expect(checkInterference(d)).toEqual([]);
    });

    it("rejects tenir que", () => {
      const d = doc({ sentences: [{ target: "Tinc que anar-hi.", en: "I have to go.", tokens: [] }] });
      const defects = checkInterference(d);
      expect(defects).toHaveLength(1);
      expect(defects[0].severity).toBe("reject");
    });

    it("rejects hi han", () => {
      const d = doc({ sentences: [{ target: "Hi han molts llibres.", en: "There are many books.", tokens: [] }] });
      expect(checkInterference(d)).toHaveLength(1);
    });

    it("rejects donar-se compte", () => {
      const d = doc({ sentences: [{ target: "Em dono compte que és tard.", en: "I realize it's late.", tokens: [] }] });
      expect(checkInterference(d)).toHaveLength(1);
    });

    it("rejects lo + adjective", () => {
      const d = doc({ sentences: [{ target: "Lo important és estudiar.", en: "The important thing is to study.", tokens: [] }] });
      expect(checkInterference(d)).toHaveLength(1);
    });

    it("rejects personal a", () => {
      const d = doc({ sentences: [{ target: "Veig a la Maria cada dia.", en: "I see Maria every day.", tokens: [] }] });
      expect(checkInterference(d)).toHaveLength(1);
    });
  });

  describe.skipIf(profile.code !== "prs")("checkInterference (prs)", () => {
    it("passes idiomatic Dari", () => {
      const d = doc({ sentences: [{ target: "من به مکتب می‌روم.", en: "I go to school.", tokens: [] }] });
      expect(checkInterference(d)).toEqual([]);
    });

    it("rejects Iranian Persian vocabulary", () => {
      const d = doc({ sentences: [{ target: "من به مدرسه می‌روم.", en: "I go to school.", tokens: [] }] });
      const defects = checkInterference(d);
      expect(defects).toHaveLength(1);
      expect(defects[0].severity).toBe("reject");
    });

    it("rejects می glued without ZWNJ", () => {
      const d = doc({ sentences: [{ target: "من میروم.", en: "I go.", tokens: [] }] });
      expect(checkInterference(d)).toHaveLength(1);
    });
  });
});
