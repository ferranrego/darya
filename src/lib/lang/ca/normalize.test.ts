import { describe, expect, it } from "vitest";
import { matchKey, normalizeCatalan, tokenizeCatalan } from "./normalize.ts";

describe("normalizeCatalan", () => {
  it("canonicalises apostrophes and the interpunct without touching accents", () => {
    expect(normalizeCatalan("l’home")).toBe("l'home");
    expect(normalizeCatalan("col‧legi")).toBe("col·legi");
    expect(normalizeCatalan("Català és així")).toBe("Català és així");
  });
});

describe("matchKey", () => {
  it("folds case and the interpunct", () => {
    expect(matchKey("Col·legi")).toBe("collegi");
    expect(matchKey("PARAL·LEL")).toBe("parallel");
  });

  it("keeps accents, because they distinguish real words", () => {
    // Folding them looks helpful but is a trap: this is a reader, so the
    // learner taps text that already carries its accents. Folding buys nothing
    // and collapses genuine minimal pairs into one lexicon key, silently
    // losing a sense.
    expect(matchKey("sí")).not.toBe(matchKey("si"));
    expect(matchKey("és")).not.toBe(matchKey("es"));
    expect(matchKey("més")).not.toBe(matchKey("mes"));
    expect(matchKey("dóna")).not.toBe(matchKey("dona"));
    // …and they survive verbatim.
    expect(matchKey("comprà")).toBe("comprà");
    expect(matchKey("conduïm")).toBe("conduïm");
    expect(matchKey("començar")).toBe("començar");
  });
});

describe("tokenizeCatalan", () => {
  it("splits an eliding clitic from its word", () => {
    expect(tokenizeCatalan("l'home")).toEqual(["l'", "home"]);
    expect(tokenizeCatalan("d'aigua")).toEqual(["d'", "aigua"]);
    expect(tokenizeCatalan("s'ha menjat")).toEqual(["s'", "ha", "menjat"]);
    expect(tokenizeCatalan("n'hi ha")).toEqual(["n'", "hi", "ha"]);
  });

  it("never splits on the interpunct", () => {
    expect(tokenizeCatalan("El col·legi és gran")).toEqual(["El", "col·legi", "és", "gran"]);
    expect(tokenizeCatalan("paral·lel")).toEqual(["paral·lel"]);
  });

  it("separates enclitic pronouns from the verb", () => {
    expect(tokenizeCatalan("dóna'm")).toEqual(["dóna", "'m"]);
    expect(tokenizeCatalan("anar-se'n")).toEqual(["anar", "se", "'n"]);
    expect(tokenizeCatalan("dona-me'l")).toEqual(["dona", "me", "'l"]);
  });

  it("drops surrounding punctuation but keeps word-internal marks", () => {
    expect(tokenizeCatalan("Hola, què tal?")).toEqual(["Hola", "què", "tal"]);
    expect(tokenizeCatalan("«L'aigua»")).toEqual(["L'", "aigua"]);
    expect(tokenizeCatalan("Sí! Molt bé.")).toEqual(["Sí", "Molt", "bé"]);
  });

  it("handles a realistic sentence end to end", () => {
    expect(tokenizeCatalan("L'Anna se'n va anar a col·legi amb l'autobús.")).toEqual([
      "L'", "Anna", "se", "'n", "va", "anar", "a", "col·legi", "amb", "l'", "autobús",
    ]);
  });

  it("returns nothing for punctuation-only input", () => {
    expect(tokenizeCatalan("... - !")).toEqual([]);
    expect(tokenizeCatalan("")).toEqual([]);
  });
});

describe("clitics and enclitics", () => {
  it("keeps a standalone clitic whole", () => {
    // A grammar drill answer is often just the clitic. Stripping the
    // apostrophe left a bare "l" that resolves to nothing.
    expect(tokenizeCatalan("L'")).toEqual(["L'"]);
    expect(tokenizeCatalan("M'")).toEqual(["M'"]);
    expect(tokenizeCatalan("a l'")).toEqual(["a", "l'"]);
  });

  it("splits an eliding clitic from the word it leans on", () => {
    expect(tokenizeCatalan("l'home")).toEqual(["l'", "home"]);
    expect(tokenizeCatalan("d'aigua")).toEqual(["d'", "aigua"]);
    expect(tokenizeCatalan("N'hi ha tres")).toEqual(["N'", "hi", "ha", "tres"]);
  });

  it("tells a leading clitic apart from a trailing enclitic", () => {
    // dir-t'ho is dir + t' + ho, but me'l is me + 'l. The difference is
    // whether a single l/d/s/n/m/t sits before the apostrophe.
    expect(tokenizeCatalan("dir-t'ho")).toEqual(["dir", "t'", "ho"]);
    expect(tokenizeCatalan("me'l")).toEqual(["me", "'l"]);
    expect(tokenizeCatalan("se'n")).toEqual(["se", "'n"]);
    expect(tokenizeCatalan("anar-se'n")).toEqual(["anar", "se", "'n"]);
    expect(tokenizeCatalan("dona-me'l")).toEqual(["dona", "me", "'l"]);
  });

  it("never splits the interpunct", () => {
    expect(tokenizeCatalan("un col·legi paral·lel")).toEqual(["un", "col·legi", "paral·lel"]);
  });
});
