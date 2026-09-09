import { describe, expect, it } from "vitest";
import { lexicon } from "../content/load.ts";
import { importedDocumentSchema } from "../content/schema.ts";
import { profile } from "../lang/index.ts";
import { cleanArticleText } from "./clean.ts";
import { assembleImport, ImportTooShortError, MAX_SENTENCES } from "./assemble.ts";

/**
 * Built from the active build's own lexicon so this test says the same thing in
 * both languages: take real entries and write real sentences with them.
 */
function article(): string {
  const words = lexicon.entries.slice(0, 40).map((e) => e.target);
  const lines: string[] = [];
  for (let i = 0; i < 6; i++) {
    const sentence = words.slice(i * 5, i * 5 + 5).join(" ");
    // Capitalised, because that is what prose looks like and what the Catalan
    // splitter needs to see. A no-op in a caseless script.
    lines.push(sentence.charAt(0).toUpperCase() + sentence.slice(1) + ".");
  }
  return cleanArticleText(lines.join(" "));
}

function assemble(text: string, familiar = new Set<string>()) {
  return assembleImport({ text, title: "Títol", sourceUrl: null, familiar });
}

describe("assembleImport", () => {
  it("produces a valid imported document", () => {
    const { doc } = assemble(article());
    const parsed = importedDocumentSchema.safeParse(doc);
    expect(parsed.success).toBe(true);
    expect(doc.source).toBe("imported");
    expect(doc.id).toMatch(/^tx-imp-/);
  });

  /**
   * The invariant that actually bites. The reader re-finds each token in its
   * sentence with `target.indexOf(surface, cursor)` and, when it cannot, drops
   * the token silently - the word simply disappears from the page with nothing
   * logged. This mirrors that walk exactly.
   */
  it("every token can be re-found in its sentence, in order", () => {
    const { doc } = assemble(article());
    for (const sentence of doc.sentences) {
      let cursor = 0;
      for (const token of sentence.tokens) {
        const at = sentence.target.indexOf(token.surface, cursor);
        expect(at, `"${token.surface}" not findable in "${sentence.target}"`).toBeGreaterThanOrEqual(0);
        cursor = at + token.surface.length;
      }
    }
  });

  it("stores sentences already normalized, so the walk above stays true", () => {
    const { doc } = assemble(article());
    for (const s of doc.sentences) {
      expect(profile.text.normalize(s.target)).toBe(s.target);
    }
  });

  it("only references shipped lexeme ids", () => {
    const { doc } = assemble(article());
    const ids = new Set(lexicon.entries.map((e) => e.id));
    for (const id of doc.vocabUsed) expect(ids.has(id)).toBe(true);
    for (const s of doc.sentences) {
      for (const t of s.tokens) {
        if (t.lexemeId) expect(ids.has(t.lexemeId)).toBe(true);
      }
    }
  });

  it("leaves every sentence untranslated", () => {
    const { doc } = assemble(article());
    expect(doc.sentences.every((s) => s.en === "")).toBe(true);
  });

  it("reports a difficulty of zero when the learner knows everything", () => {
    const familiar = new Set(lexicon.entries.map((e) => e.id));
    const { doc } = assemble(article(), familiar);
    expect(doc.newWordRatio).toBe(0);
  });

  it("reports a high difficulty when the learner knows nothing", () => {
    const { doc } = assemble(article());
    expect(doc.newWordRatio).toBeGreaterThan(0.5);
    expect(doc.newWordRatio).toBeLessThanOrEqual(1);
  });

  it("refuses a page with almost no text", () => {
    expect(() => assemble("Massa curt.")).toThrow(ImportTooShortError);
  });

  it("truncates a very long article rather than failing", () => {
    const long = Array.from({ length: MAX_SENTENCES + 50 }, (_, i) => `Frase ${i} aqui llarga.`).join(" ");
    const { doc, truncated } = assemble(long);
    expect(truncated).toBe(true);
    expect(doc.sentences.length).toBeLessThanOrEqual(MAX_SENTENCES);
  });

  it("marks capitalised mid-sentence unknowns as names in a cased script", () => {
    const { doc } = assemble(cleanArticleText(article() + " Ahir Zzzqqq va parlar molt clar."));
    const names = doc.sentences.flatMap((s) => s.tokens).filter((t) => t.kind === "name");
    if (profile.dir === "ltr") {
      expect(names.length).toBeGreaterThan(0);
      // A name is never offered as vocabulary to look up.
      for (const n of names) expect(doc.oovSurfaces).not.toContain(n.surface.toLowerCase());
    } else {
      // No capitalisation signal exists in Perso-Arabic script.
      expect(names).toHaveLength(0);
    }
  });
});
