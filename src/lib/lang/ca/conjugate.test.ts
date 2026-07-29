import { describe, expect, it } from "vitest";
import { attach, conjugationSurfaces, stemOf } from "./conjugate.ts";
import { IRREGULAR_VERBS } from "./irregulars.ts";
import { verbSpec } from "./lexicon-index.ts";

/** Every surface form of a verb, as a Set for membership assertions. */
function forms(infinitive: string): Set<string> {
  const spec = verbSpec(infinitive);
  if (!spec) throw new Error(`not a verb: ${infinitive}`);
  return new Set(conjugationSurfaces(spec));
}

describe("orthographic attachment", () => {
  it("respells a stem-final consonant before a front vowel", () => {
    expect(attach("toc", "em")).toBe("toquem"); // c -> qu
    expect(attach("pag", "em")).toBe("paguem"); // g -> gu
    expect(attach("començ", "em")).toBe("comencem"); // ç -> c
    expect(attach("menj", "em")).toBe("mengem"); // j -> g
  });

  it("leaves the stem alone before a back vowel", () => {
    expect(attach("toc", "o")).toBe("toco");
    expect(attach("pag", "o")).toBe("pago");
    expect(attach("començ", "o")).toBe("començo");
  });

  it("adds a diaeresis to keep i/u syllabic after a stem vowel", () => {
    expect(attach("condu", "im")).toBe("conduïm");
    expect(attach("agra", "im")).toBe("agraïm");
    // …but not when the ending already carries its own accent,
    // nor after qu/gu, where the u is a silent digraph member.
    expect(attach("condu", "ís")).toBe("conduís");
    expect(attach("segu", "im")).toBe("seguim");
    expect(attach("segu", "eixi")).toBe("segueixi");
  });
});

describe("regular paradigms", () => {
  it("first conjugation: parlar", () => {
    const f = forms("parlar");
    for (const w of ["parlo", "parles", "parla", "parlem", "parleu", "parlen"]) {
      expect(f.has(w), w).toBe(true);
    }
    expect(f.has("parlava")).toBe(true);
    expect(f.has("parlàvem")).toBe(true); // accent shift in 1pl imperfect
    expect(f.has("parlaré")).toBe(true);
    expect(f.has("parlaria")).toBe(true);
    expect(f.has("parli")).toBe(true); // present subjunctive
    expect(f.has("parlés")).toBe(true); // imperfect subjunctive
    expect(f.has("parlat")).toBe(true);
    expect(f.has("parlades")).toBe(true);
    expect(f.has("parlant")).toBe(true);
  });

  it("second conjugation: perdre (future drops the -e)", () => {
    const f = forms("perdre");
    expect(f.has("perdo")).toBe(true);
    expect(f.has("perd")).toBe(true);
    expect(f.has("perdem")).toBe(true);
    expect(f.has("perdré")).toBe(true); // not "perdreré"
    expect(f.has("perdria")).toBe(true);
    expect(f.has("perdut")).toBe(true);
    expect(f.has("perdent")).toBe(true);
  });

  it("third conjugation, incoative by default: servir", () => {
    const f = forms("servir");
    expect(f.has("serveixo")).toBe(true);
    expect(f.has("serveix")).toBe(true);
    expect(f.has("servim")).toBe(true); // 1pl has no -eix-
    expect(f.has("serveixin")).toBe(true);
    expect(f.has("servit")).toBe(true);
  });

  it("third conjugation, pure: dormir", () => {
    const f = forms("dormir");
    expect(f.has("dormo")).toBe(true);
    expect(f.has("dorm")).toBe(true);
    expect(f.has("dormim")).toBe(true);
    expect(f.has("dormeixo"), "pure verbs take no -eix-").toBe(false);
  });

  it("applies orthography across a whole paradigm", () => {
    expect(forms("tocar").has("toquem")).toBe(true);
    expect(forms("tocar").has("toqui")).toBe(true);
    expect(forms("pagar").has("pagui")).toBe(true);
    expect(forms("començar").has("comencem")).toBe(true);
    expect(forms("menjar").has("mengi")).toBe(true);
    expect(forms("conduir").has("conduïm")).toBe(true);
  });
});

describe("irregular verbs", () => {
  it("ser is suppletive and generates no regular stem forms", () => {
    const f = forms("ser");
    for (const w of ["soc", "ets", "és", "som", "sou", "són", "era", "seré", "sigui", "fos", "sent"]) {
      expect(f.has(w), w).toBe(true);
    }
    // The failure mode this guards: a regular paradigm over the stem "s"
    // would invent these.
    for (const bogus of ["so", "ses", "sem", "seu", "sen", "sia"]) {
      expect(f.has(bogus), `invented form ${bogus}`).toBe(false);
    }
  });

  it("anar mixes a suppletive present with a regular imperfect", () => {
    const f = forms("anar");
    for (const w of ["vaig", "vas", "va", "anem", "aneu", "van", "vagi", "aniré"]) {
      expect(f.has(w), w).toBe(true);
    }
    expect(f.has("anava"), "imperfect stays regular").toBe(true);
    expect(f.has("ano"), "suppletive present must replace, not extend").toBe(false);
  });

  it("velar-insertion verbs build the subjunctive on a stem absent from the infinitive", () => {
    expect(forms("tenir").has("tinc")).toBe(true);
    expect(forms("tenir").has("tingui")).toBe(true);
    expect(forms("venir").has("vinguem")).toBe(true);
    expect(forms("prendre").has("prenguin")).toBe(true);
    expect(forms("poder").has("pugui")).toBe(true);
    expect(forms("voler").has("vulguis")).toBe(true);
  });

  it("keeps irregular participles", () => {
    expect(forms("fer").has("fet")).toBe(true);
    expect(forms("dir").has("dit")).toBe(true);
    expect(forms("veure").has("vist")).toBe(true);
    expect(forms("obrir").has("obert")).toBe(true);
    expect(forms("escriure").has("escrit")).toBe(true);
    expect(forms("prendre").has("pres")).toBe(true);
  });

  it("-ndre and -ure verbs take their velar stem", () => {
    // These are the patterns no rule can derive from the infinitive: the 1sg
    // and the whole subjunctive are built on a stem that never appears in it.
    expect(forms("vendre").has("venc")).toBe(true);
    expect(forms("vendre").has("vengui")).toBe(true);
    expect(forms("vendre").has("venut")).toBe(true);
    expect(forms("riure").has("ric")).toBe(true);
    expect(forms("riure").has("rigui")).toBe(true);
    expect(forms("somriure").has("somric")).toBe(true);
    expect(forms("somriure").has("somrient")).toBe(true);
    // …and the regular paradigm must not survive alongside them.
    expect(forms("vendre").has("vendo"), "invented regular form").toBe(false);
    expect(forms("riure").has("riuo"), "invented regular form").toBe(false);
  });

  it("every irregular entry declares a conjugation its infinitive supports", () => {
    for (const [inf, spec] of Object.entries(IRREGULAR_VERBS)) {
      expect(spec.infinitive, `${inf}: infinitive must match its key`).toBe(inf);
      expect(stemOf(inf, spec.conjugation).length, `${inf}: stem`).toBeGreaterThan(0);
      // No slot may be empty - an empty override would silently delete a tense.
      for (const [slot, list] of Object.entries(spec.overrides ?? {})) {
        expect(list.length, `${inf}.${slot}`).toBeGreaterThan(0);
        for (const form of list) expect(form.trim(), `${inf}.${slot}`).not.toBe("");
      }
    }
  });
});
