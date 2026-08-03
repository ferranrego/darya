import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { attach, conjugationSurfaces, stemOf } from "./conjugate.ts";
import { IRREGULAR_VERBS } from "./irregulars.ts";
import { buildLexiconIndex, nominalForms, verbSpec } from "./lexicon-index.ts";

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

describe("noun and adjective inflection", () => {
  const has = (w: string, pos: string, f: string) => nominalForms(w, pos).includes(f);

  it("forms the feminine of the patterns Catalan actually uses", () => {
    // The pairs an English speaker meets constantly, and the ones a naive
    // "add -a" rule gets wrong.
    expect(has("bo", "adjective", "bona"), "bo -> bona").toBe(true);
    expect(has("cansat", "adjective", "cansada"), "participle voices").toBe(true);
    expect(has("petit", "adjective", "petita"), "plain adjective does not").toBe(true);
    expect(has("blau", "adjective", "blava"), "blau -> blava").toBe(true);
    expect(has("pobre", "adjective", "pobra"), "pobre -> pobra").toBe(true);
    expect(has("feliç", "adjective", "felices"), "feliç -> felices").toBe(true);
  });

  it("does not devoice the -nt cluster like a vowel-final participle", () => {
    // The t -> d devoicing candidate (cansat -> cansada) is a participial
    // pattern that only fires after a vowel. Applied blindly to any word
    // ending in "t", it also fired after the -nt cluster of present,
    // important, valent - producing "presenda"/"importanda"/"valenda", which
    // are not words under any reading.
    //
    // present/important are also invariant adjectives (no feminine at all -
    // see the invariant-class test below), so their plain "-a" candidate is
    // gone too now; valent is a named exception to that class and keeps its
    // real feminine.
    expect(has("present", "adjective", "presenda"), "presenda is not a word").toBe(false);
    expect(has("important", "adjective", "importanda"), "importanda is not a word").toBe(false);
    expect(has("valent", "adjective", "valenda"), "valenda is not a word").toBe(false);
    expect(has("valent", "adjective", "valenta"), "valent -> valenta is real").toBe(true);
    // The devoicing candidate must still fire for genuine participles, where
    // the t follows a vowel rather than a consonant cluster.
    expect(has("cansat", "adjective", "cansada"), "vowel+t still devoices").toBe(true);
  });

  it("does not invent a feminine for gender-invariant adjective classes", () => {
    // "una decisió important", never "importanta" - a catalan-philologist
    // review sourced these suffixes as exception-free or near enough to
    // enumerate. Scoped to pos "adjective" only: the same endings on a noun
    // (general the military rank -> generala) still need the feminine, which
    // the over-generation policy already covers and this must not disturb.
    for (const w of [
      "popular", "impopular", "particular", "familiar", "similar", // -ar
      "normal", "final", "social", "natural", "legal", // -al
      "possible", "terrible", "amable", // -ble
      "superior", "inferior", "anterior", // -erior
      "important", "present", "urgent", "eficient", // -nt (productive class)
      "fàcil", "difícil", "civil", // -il
    ]) {
      expect(nominalForms(w, "adjective"), `${w} should have no feminine`).not.toContain(w + "a");
    }
    // The over-generation policy is unaffected for nouns on the same endings.
    expect(has("general", "noun", "generala"), "general (rank, noun) still inflects").toBe(true);
  });

  it("still inflects the named exceptions within each invariant class", () => {
    expect(has("car", "adjective", "cara"), "car -> cara is a named -ar exception").toBe(true);
    expect(has("clar", "adjective", "clara")).toBe(true);
    expect(has("mal", "adjective", "mala"), "mal -> mala is a named -al exception").toBe(true);
    expect(has("content", "adjective", "contenta"), "content -> contenta is a named -nt exception").toBe(true);
    expect(has("valent", "adjective", "valenta")).toBe(true);
    expect(has("calent", "adjective", "calenta")).toBe(true);
    expect(has("anglòfil", "adjective", "anglòfila"), "-òfil compounds still inflect").toBe(true);
    // tranquil is irregular, not invariant: the real feminine has l·l, not
    // the "tranquila" the generic rule used to invent.
    expect(has("tranquil", "adjective", "tranquil·la")).toBe(true);
    expect(has("tranquil", "adjective", "tranquila"), "tranquila is not a word").toBe(false);
  });

  it("forms plurals including the irregular shapes", () => {
    expect(has("bo", "adjective", "bons"), "stressed vowel takes -ns").toBe(true);
    expect(has("gos", "noun", "gossos"), "monosyllable in -s doubles it").toBe(true);
    expect(has("casa", "noun", "cases")).toBe(true);
    expect(has("gran", "adjective", "grans")).toBe(true);
    expect(has("feliç", "adjective", "feliços")).toBe(true);
  });

  it("drops the written accent in the -ns plural", () => {
    // germà -> germans, not *germàns. Getting this wrong left the plural of
    // every kinship and abstract noun unresolvable in the reader.
    expect(has("germà", "noun", "germans"), "germà -> germans").toBe(true);
    expect(has("mà", "noun", "mans"), "mà -> mans").toBe(true);
    expect(has("camí", "noun", "camins"), "camí -> camins").toBe(true);
    expect(has("raó", "noun", "raons"), "raó -> raons").toBe(true);
    // The -s plural keeps it, since an oxytone in vowel+s still needs the mark.
    expect(has("cafè", "noun", "cafès"), "cafè -> cafès").toBe(true);
  });
});

describe("verbs the grammar course leans on", () => {
  it("gives anar the periphrastic-past auxiliary as well as the present", () => {
    // "vam anar" is "we went"; "anem" is "we go". Both have to resolve, and
    // vam/vau are not derivable from anem/aneu.
    const anar = forms("anar");
    for (const f of ["vaig", "vas", "va", "vam", "vau", "van", "vàrem", "vàreu", "anem"]) {
      expect(anar.has(f), `anar: ${f}`).toBe(true);
    }
  });

  it("keeps defective verbs defective", () => {
    // caldre exists only in the third person and ploure only in the third
    // singular. Generating *calc or *plovem would teach a form nobody uses.
    const caldre = forms("caldre");
    expect(caldre.has("cal")).toBe(true);
    expect(caldre.has("calgui")).toBe(true);
    expect(caldre.has("calc"), "no invented first person").toBe(false);
    const ploure = forms("ploure");
    expect(ploure.has("plou")).toBe(true);
    expect(ploure.has("plovem"), "no invented plural").toBe(false);
  });

  it("handles the two-stem verbs", () => {
    for (const [inf, expected] of [
      ["treure", ["trec", "traiem", "tret"]],
      ["néixer", ["neix", "naixem", "nascut"]],
      ["caure", ["caic", "caiem", "caigut"]],
      ["seure", ["sec", "seiem", "segut"]],
      ["moure", ["moc", "movem", "mogut"]],
    ] as const) {
      const set = forms(inf);
      for (const f of expected) expect(set.has(f), `${inf}: ${f}`).toBe(true);
    }
  });
});

describe("darrer/darrere - a real lexicon mis-tagging, not a generator bug", () => {
  // "darrera" was authored as a variant spelling of "darrere" (behind), but
  // Optimot is explicit that darrera is only ever the feminine of the
  // adjective darrer (last) - the 1995 IEC dictionary rejects it for the
  // preposition entirely. The mistagged variant let the resolver's authored-
  // beats-generated precedence shadow the adjective's own real feminine.
  const root = join(import.meta.dirname, "..", "..", "..", "..", "content", "ca");
  const entries = JSON.parse(readFileSync(join(root, "lexicon", "lexicon.json"), "utf8")).entries;
  const index = buildLexiconIndex(entries);

  it("resolves darrera to the adjective, not the preposition", () => {
    const hit = index.resolve("darrera");
    expect(hit?.pos, "darrera should be darrer (last), fem.").toBe("adjective");
  });

  it("still resolves darrere to the preposition", () => {
    const hit = index.resolve("darrere");
    expect(hit?.pos).toBe("preposition");
  });
});
