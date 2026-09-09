import { describe, expect, it } from "vitest";
import { splitSentencesCatalan as split } from "./sentences.ts";

/**
 * These run in both language builds - every profile is bundled - so they test
 * the Catalan splitter directly rather than through the active profile.
 */
describe("splitSentencesCatalan", () => {
  it("splits on sentence-final punctuation", () => {
    expect(split("La casa és gran. El riu és blau. Què fas?")).toEqual([
      "La casa és gran.",
      " El riu és blau.",
      " Què fas?",
    ]);
  });

  it("does not split an abbreviation", () => {
    expect(split("El Sr. Puig va arribar tard.")).toHaveLength(1);
    expect(split("Vegeu la pàg. 12 del llibre.")).toHaveLength(1);
    expect(split("Pomes, peres, etc. Tot era fresc.")).toHaveLength(1);
  });

  it("does not split a decimal or a date", () => {
    expect(split("El preu era 3.50 euros al mercat.")).toHaveLength(1);
    expect(split("Va passar el 12.03.2026 al matí.")).toHaveLength(1);
  });

  it("does not split an initial", () => {
    expect(split("En J. Pujol va parlar ahir.")).toHaveLength(1);
  });

  it("does not split an ordinal", () => {
    expect(split("Viu al 3r. pis de l'edifici.")).toHaveLength(1);
  });

  it("keeps a closing guillemet with its sentence", () => {
    expect(split("Va dir «no vindré». Després va marxar.")).toEqual([
      "Va dir «no vindré».",
      " Després va marxar.",
    ]);
  });

  it("treats an ellipsis followed by a capital as an end", () => {
    expect(split("No ho sé… Potser demà.")).toHaveLength(2);
  });

  it("does not split a lowercase continuation", () => {
    // A dot followed by a lowercase word is not a sentence boundary in Catalan.
    expect(split("Era l'any 1992. i tot va canviar")).toHaveLength(1);
  });

  it("splits a terminator welded to the next block", () => {
    // HTML-to-text conversion drops the separator between block elements.
    expect(split("Què va passar?Mira la versió de text.")).toHaveLength(2);
  });

  it("does not split a welded lowercase continuation", () => {
    expect(split("Val 3.50 euros al mercat de la vila.")).toHaveLength(1);
  });


  it("treats a line break as a sentence boundary", () => {
    const parts = split("Comparteix aquest article\nEl riu de la vila és blau.");
    expect(parts).toHaveLength(2);
    expect(parts[1].trim()).toBe("El riu de la vila és blau.");
  });

  it("loses no text across line breaks", () => {
    const input = "Primera línia\nSegona línia. Tercera frase.\n\nQuarta línia";
    expect(split(input).join("")).toBe(input);
  });

  it("hard-wraps an unpunctuated wall of text", () => {
    const wall = Array.from({ length: 120 }, () => "paraula").join(" ");
    const parts = split(wall);
    expect(parts.length).toBeGreaterThan(1);
    for (const p of parts) expect(p.length).toBeLessThanOrEqual(400);
  });

  // The invariant that matters: this runs on an article the learner chose to
  // read, so the splitter must never drop any of it.
  it("loses no text", () => {
    const inputs = [
      "La casa és gran. El riu és blau. Què fas?",
      "El Sr. Puig va arribar tard. Vegeu la pàg. 12.",
      "Va dir «no vindré». Després va marxar…",
      Array.from({ length: 120 }, () => "paraula").join(" "),
    ];
    for (const input of inputs) {
      expect(split(input).join("")).toBe(input);
    }
  });
});
