import { describe, expect, it, vi } from "vitest";
import { TRANSLITERATED } from "./lang-format.ts";

/**
 * `completeJson` must never actually run here: it draws on the shared free-tier
 * provider chain a real learner's next request needs. Stubbed so the prompt and
 * the validator can be tested offline, which is the only way this file is ever
 * exercised.
 */
const calls: { prompt: string; opts: { validate: (raw: string) => unknown } }[] = [];
vi.mock("./providers.ts", () => ({
  completeJson: (prompt: string, opts: { validate: (raw: string) => unknown }) => {
    calls.push({ prompt, opts });
    return Promise.resolve(null);
  },
  deadlineIn: (ms: number) => Date.now() + ms,
}));

const { translateImportSpan, importTranslationSchema } = await import("./import-translate.ts");

async function capture(sentences: string[], title?: string) {
  calls.length = 0;
  await translateImportSpan({ sentences, title });
  return calls[0];
}

describe("translateImportSpan prompt", () => {
  it("numbers every sentence it sends", async () => {
    const { prompt } = await capture(["Una.", "Dues.", "Tres."]);
    expect(prompt).toContain("0: Una.");
    expect(prompt).toContain("1: Dues.");
    expect(prompt).toContain("2: Tres.");
  });

  it("asks for JSON, which the providers' response format requires", async () => {
    const { prompt } = await capture(["Una."]);
    expect(prompt).toContain("JSON");
  });

  it("asks for a transliteration only when the language has one", async () => {
    const { prompt } = await capture(["Una."]);
    if (TRANSLITERATED) {
      expect(prompt).toContain('"translit"');
    } else {
      expect(prompt).toContain("Do NOT include");
    }
  });

  it("only asks about a title when there is one", async () => {
    expect((await capture(["Una."], "Titol")).prompt).toContain("TITLE: Titol");
    expect((await capture(["Una."])).prompt).not.toContain("TITLE:");
  });

  it("forbids simplifying or dropping sentences", async () => {
    const { prompt } = await capture(["Una."]);
    expect(prompt).toContain("Do not merge, split, reorder, summarise or skip");
  });
});

/**
 * The alignment check is the one that matters. A model that renumbers, drops or
 * duplicates a sentence would otherwise put every English line against the
 * wrong target sentence, silently, for the rest of the article.
 */
describe("translateImportSpan validator", () => {
  const t = TRANSLITERATED ? { translit: "x" } : {};

  async function validate(sentences: string[], payload: unknown) {
    const { opts } = await capture(sentences);
    return () => opts.validate(JSON.stringify(payload));
  }

  it("accepts a correctly aligned response", async () => {
    const check = await validate(["a", "b"], {
      sentences: [
        { i: 0, en: "A", ...t },
        { i: 1, en: "B", ...t },
      ],
      names: [],
    });
    expect(check).not.toThrow();
  });

  it("rejects a missing sentence", async () => {
    const check = await validate(["a", "b"], { sentences: [{ i: 0, en: "A", ...t }], names: [] });
    expect(check).toThrow(/1 of 2/);
  });

  it("rejects a duplicated index", async () => {
    const check = await validate(["a", "b"], {
      sentences: [
        { i: 0, en: "A", ...t },
        { i: 0, en: "B", ...t },
      ],
      names: [],
    });
    expect(check).toThrow(/twice/);
  });

  it("rejects an index that was never sent", async () => {
    const check = await validate(["a"], {
      sentences: [
        { i: 0, en: "A", ...t },
        { i: 7, en: "B", ...t },
      ],
      names: [],
    });
    expect(check).toThrow(/only 0\.\.0/);
  });

  it("rejects a response with no title when a title was sent", async () => {
    calls.length = 0;
    await translateImportSpan({ sentences: ["a"], title: "T" });
    expect(() =>
      calls[0].opts.validate(JSON.stringify({ sentences: [{ i: 0, en: "A", ...t }], names: [] })),
    ).toThrow(/no title/);
  });

  it("defaults names to an empty list", () => {
    const parsed = importTranslationSchema.parse({ sentences: [] });
    expect(parsed.names).toEqual([]);
  });
});
