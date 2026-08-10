import { describe, expect, it } from "vitest";
import { profile } from "../index.ts";
import { lexicon } from "../../content/load.ts";
import {
  agreeAdjective,
  definiteArticle,
  feminineOf,
  indefiniteArticle,
  pluralOf,
  presentOf,
  withPreposition,
} from "./surface.ts";
import { nominalForms } from "./lexicon-index.ts";

/**
 * Every hazard the Catalan philology review named for a slot-filling engine,
 * turned into an assertion. Each case states the rule and the wrong output a
 * naive filler would produce, per CLAUDE.md's "an agent finding graduates
 * into a mechanical check."
 */
describe("agreeAdjective", () => {
  it("regular gender+number agreement: gos/gossa-shaped adjectives", () => {
    expect(agreeAdjective("petit", "m", "sg")).toBe("petit");
    expect(agreeAdjective("petit", "f", "sg")).toBe("petita");
    expect(agreeAdjective("petit", "m", "pl")).toBe("petits");
    expect(agreeAdjective("petit", "f", "pl")).toBe("petites");
  });

  it("distinguishes plain +a from participial devoicing on the same -t ending", () => {
    // petit -> petita (plain, the productive default), cansat -> cansada
    // (devoices, a participle used as an adjective) - spelling alone cannot
    // tell them apart, which is why the devoicing class is listed explicitly
    // rather than detected.
    expect(feminineOf("petit")).toBe("petita");
    expect(agreeAdjective("cansat", "f", "sg")).toBe("cansada");
  });

  it("leaves gran and jove unchanged for both genders - real invariant adjectives", () => {
    expect(agreeAdjective("gran", "m", "sg")).toBe("gran");
    expect(agreeAdjective("gran", "f", "sg")).toBe("gran");
    expect(agreeAdjective("jove", "m", "sg")).toBe("jove");
    expect(agreeAdjective("jove", "f", "sg")).toBe("jove");
  });

  it("leaves -ble/-al/-nt classes invariant, but inflects their listed exceptions", () => {
    expect(agreeAdjective("possible", "f", "sg")).toBe("possible");
    expect(agreeAdjective("important", "f", "sg")).toBe("important");
    expect(agreeAdjective("normal", "f", "sg")).toBe("normal");
    // content is an NT_EXCEPTIONS member: it does inflect.
    expect(agreeAdjective("content", "f", "sg")).toBe("contenta");
    // clar is an AR_EXCEPTIONS member: it does inflect too.
    expect(agreeAdjective("clar", "f", "sg")).toBe("clara");
  });

  it("feliç/feliça (fem sg) vs feliços/felices (masc/fem pl) - ç does not collapse the two", () => {
    expect(agreeAdjective("feliç", "f", "sg")).toBe("feliça");
    expect(agreeAdjective("feliç", "m", "pl")).toBe("feliços");
    expect(agreeAdjective("feliç", "f", "pl")).toBe("felices");
  });
});

describe("pluralOf", () => {
  it("gos -> gossos: monosyllable stressed -s doubles", () => {
    expect(pluralOf("gos")).toBe("gossos");
  });

  it("throws rather than guess a stressed-final-vowel plural's accent", () => {
    // germans drops the accent, béns keeps it - not decidable from spelling.
    expect(() => pluralOf("cafè")).toThrow(/IRREGULAR_PLURAL/);
    expect(pluralOf("germà")).toBe("germans");
  });

  it("respells c/g/ç/j before the feminine plural -es", () => {
    expect(pluralOf("rica")).toBe("riques");
    expect(pluralOf("llarga")).toBe("llargues");
  });
});

describe("definiteArticle / withPreposition", () => {
  it("elides before a vowel or h", () => {
    expect(definiteArticle("home", "m", "sg")).toBe("l'");
    expect(definiteArticle("aigua", "f", "sg")).toBe("l'");
    expect(definiteArticle("hospital", "m", "sg")).toBe("l'");
  });

  it("does NOT elide la before an unstressed i-/u-, but does before a stressed one", () => {
    expect(definiteArticle("idea", "f", "sg")).toBe("la");
    expect(definiteArticle("universitat", "f", "sg")).toBe("la");
    // illa: stressed i-, elides normally (not in the exception list).
    expect(definiteArticle("illa", "f", "sg")).toBe("l'");
  });

  it("never elides in the plural", () => {
    expect(definiteArticle("home", "m", "pl")).toBe("els");
    expect(definiteArticle("aigua", "f", "pl")).toBe("les");
  });

  it("contracts a/de/per + el, but never + la or an elided l' - and always includes the noun", () => {
    // A regression case: the first version of this function returned just
    // the contracted article ("al", "a la") and silently dropped the noun,
    // which produced "Hi ha un gat a la." in a real generated sentence - a
    // bug this exact test was supposed to catch and, by asserting the buggy
    // output as correct, did not.
    expect(withPreposition("a", "mercat", "m", "sg")).toBe("al mercat");
    expect(withPreposition("de", "mercat", "m", "sg")).toBe("del mercat");
    expect(withPreposition("per", "mercat", "m", "sg")).toBe("pel mercat");
    // The noun surface is taken as given - number only decides the article,
    // the same contract definiteArticle has - so a plural call passes the
    // already-pluralized noun (surface.ts does not re-derive it).
    expect(withPreposition("a", "mercats", "m", "pl")).toBe("als mercats");
    expect(withPreposition("a", "casa", "f", "sg")).toBe("a la casa");
    expect(withPreposition("a", "home", "m", "sg")).toBe("a l'home");
  });
});

describe("presentOf", () => {
  it("gives the authored irregular present of the high-utility verbs", () => {
    expect(presentOf("ser", "1sg")).toBe("soc");
    expect(presentOf("estar", "3sg")).toBe("està");
    expect(presentOf("tenir", "1sg")).toBe("tinc");
    expect(presentOf("haver", "3sg")).toBe("ha");
    expect(presentOf("anar", "3sg")).toBe("va");
    expect(presentOf("fer", "1sg")).toBe("faig");
  });

  it("derives a regular -ar verb through attach/stemOf, respelling the stem where needed", () => {
    expect(presentOf("parlar", "1sg")).toBe("parlo");
    expect(presentOf("parlar", "2sg")).toBe("parles");
    // menjar -> mengem-shaped respelling only applies to front-vowel endings;
    // 1sg -o is a back vowel, so the stem consonant is untouched.
    expect(presentOf("menjar", "1sg")).toBe("menjo");
    expect(presentOf("menjar", "2sg")).toBe("menges");
  });

  it("throws for a verb outside regular -ar and the authored irregular set", () => {
    expect(() => presentOf("dormir", "3sg")).toThrow(/only regular -ar verbs/);
  });
});

describe("indefiniteArticle", () => {
  it("agrees un/una/uns/unes", () => {
    expect(indefiniteArticle("m", "sg")).toBe("un");
    expect(indefiniteArticle("f", "sg")).toBe("una");
    expect(indefiniteArticle("m", "pl")).toBe("uns");
    expect(indefiniteArticle("f", "pl")).toBe("unes");
  });
});

/**
 * The two implementations must not silently diverge: anything this module
 * emits for a real lexicon word should be a form `nominalForms` (the
 * resolution index) would also recognise, or a learner tapping the generated
 * word gets nothing back.
 */
describe("agrees with the resolution index", () => {
  // The rest of this file tests pure functions with hardcoded Catalan
  // literals and is safe under any active language. This one test reads
  // `lexicon` from content/load.ts, which resolves through @content to
  // whichever language NEXT_PUBLIC_TARGET_LANG names - running it under the
  // Dari build would feed Dari words to Catalan-only feminine-formation
  // rules. Real Catalan-only content needs a real Catalan-only guard, not
  // just a label in the describe() string.
  it.runIf(profile.code === "ca")("every regular adjective's derived feminine resolves through nominalForms", () => {
    const adjectives = lexicon.entries.filter((e) => e.pos === "adjective").slice(0, 200);
    let checked = 0;
    for (const entry of adjectives) {
      const lemma = entry.targetNormalized;
      if (lemma.includes(" ") || lemma.includes("·")) continue;
      let fem: string;
      try {
        fem = feminineOf(lemma);
      } catch {
        continue; // not covered yet (an -t adjective not in IRREGULAR_FEMININE) - fine, this module refuses rather than guesses
      }
      if (fem === lemma) continue; // invariant
      checked++;
      const candidates = nominalForms(lemma, "adjective");
      expect(candidates, `${lemma} -> ${fem} not in nominalForms(${lemma})`).toContain(fem);
    }
    expect(checked).toBeGreaterThan(20);
  });
});
