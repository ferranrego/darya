import { describe, expect, it } from "vitest";

import {
  VERIFIED_SHORT_VOWEL,
  bareShortIEnding,
  cheAsWord,
  isFlattenedTranslit,
  scriptLongVowelCount,
  shortEVowel,
  verb1plIm,
  isShortEException,
  medialYehWithoutLongVowel,
  nonBuPrefix,
  shortEInLooseText,
} from "./translit-check.ts";

/** Checks added after the philologist reviewed the i sweep. */
describe("spelling review checks", () => {
  const stems = [
    { latin: "dān", dari: "دان" },
    { latin: "gīr", dari: "گیر" },
    { latin: "dih", dari: "ده" },
    { latin: "raw", dari: "رو" },
    { latin: "bast", dari: "بست" },
  ];

  it("nonBuPrefix catches bi-/ba- verbs and leaves bu-, biyā, nouns and b-root pasts", () => {
    expect(nonBuPrefix("man bāyad bidānam.", "من باید بدانم.", stems)).toBe("bidānam");
    expect(nonBuPrefix("kitāb badihēd", "کتاب بدهید", stems)).toBe("badihēd");
    expect(nonBuPrefix("man bāyad budānam.", "من باید بدانم.", stems)).toBeNull();
    expect(nonBuPrefix("zūd biyā", "زود بیا", stems)).toBeNull();
    expect(nonBuPrefix("pardākht-e bidihī", "پرداخت بدهی", stems)).toBeNull();
    expect(nonBuPrefix("birinj", "برنج", stems)).toBeNull();
    // unaligned: no evidence, no verdict
    expect(nonBuPrefix("bidānam", "من بدانم", stems)).toBeNull();
  });

  it("medialYehWithoutLongVowel reports a written ی with no long vowel, not the ezafe or a final -i", () => {
    expect(medialYehWithoutLongVowel("rizish", "ریزش")).toEqual(["rizish"]);
    expect(medialYehWithoutLongVowel("bi-rawiya-ye", "بی‌رویه")).toEqual(["bi-rawiya-ye"]);
    expect(medialYehWithoutLongVowel("rēzish", "ریزش")).toEqual([]);
    expect(medialYehWithoutLongVowel("tijāri", "تجاری")).toEqual([]);
    expect(medialYehWithoutLongVowel("kitāb-hā-ye", "کتابهای")).toEqual([]);
  });

  it("shortEInLooseText flags a Dari word in a table cell and never the English beside it", () => {
    const vocab = new Set(["giriftan", "girift", "mumkin", "dih"]);
    expect(shortEInLooseText("gereftan, to take", vocab)).toBe("gereftan");
    expect(shortEInLooseText("dād · deh", vocab)).toBe("deh");
    expect(shortEInLooseText("mumken ast ki, it may be that", vocab)).toBe("mumken");
    expect(shortEInLooseText("never before, the verb", vocab)).toBeNull();
  });

  it("cheAsWord catches چه written with a majhul ē too", () => {
    expect(cheAsWord("padar chē mēkunad?")).toBe("chē");
  });

  it("verb1plIm knows bāsh, mān and gōy without a stem table", () => {
    expect(verb1plIm("mā bāshīm")).toBe("bāshīm");
    expect(verb1plIm("bumānīm")).toBe("bumānīm");
    expect(verb1plIm("bugōyīm")).toBe("bugōyīm");
  });

  it("exempts a short loanword only whole: tez passes, tezī does not", () => {
    expect(isShortEException("tez")).toBe(true);
    expect(isShortEException("tezī")).toBe(false);
    expect(isShortEException("internetī")).toBe(true);
    // losing variants are not exempt, so they cannot come back
    for (const w of ["telefōn", "sistem", "sīstem", "sigret", "metr", "resturān", "hastel", "pelan", "arme", "estāndārd"]) {
      expect(isShortEException(w), w).toBe(false);
    }
  });
});

/**
 * The spelling convention: short kasra i, چه chi, 1pl -ēm. Each test that
 * accepts something pins a way the rule could have been written too broadly:
 * the ezafe, majhul ē, a loanword, a noun in -īm.
 */
describe("short e", () => {
  it("catches the Iranian kasra", () => {
    expect(shortEVowel("man ketāb mēkhānam")).toBe("ketāb");
    expect(shortEVowel("emrōz sard ast")).toBe("emrōz");
    expect(shortEVowel("ō mu'allem ast")).toBe("mu'allem");
    expect(shortEVowel("Ketāb-e man")).toBe("Ketāb-e");
  });

  it("keeps the ezafe, which is its own segment", () => {
    expect(shortEVowel("kitāb-e man")).toBeNull();
    expect(shortEVowel("khāna-ye mā")).toBeNull();
    expect(shortEVowel("kitāb-hā-ye naw-e man")).toBeNull();
  });

  it("never reads majhul ē as a short e, composed or decomposed", () => {
    expect(shortEVowel("mā dōst hastēm, nēst, sē, mērawēm")).toBeNull();
    expect(shortEVowel("mērawēm")).toBeNull();
  });

  it("still catches a short e hiding in a hyphen compound", () => {
    expect(shortEVowel("zabān-shenāsi")).toBe("zabān-shenāsi");
    expect(shortEVowel("kitāb-e ketāb")).toBe("ketāb");
  });

  it("exempts listed loanwords, inflected too, but not a word that only starts like one", () => {
    expect(shortEVowel("hotel, model-hā, internetī, restorān-hā-ye naw")).toBeNull();
    expect(shortEVowel("testament")).toBe("testament");
  });

  it("ignores the ezafe quoted as a word of its own", () => {
    // Run on transliteration only, never on English: "after" would fail.
    expect(shortEVowel("kitāb + -e = kitāb-e; khāna + -ye = khāna-ye")).toBeNull();
  });
});

describe("che", () => {
  it("catches چه written che, alone or sentence-initial", () => {
    expect(cheAsWord("ō che mēgōyad?")).toBe("che");
    expect(cheAsWord("Che gap ast?")).toBe("Che");
  });

  it("accepts chi, the spoken chī, and words that merely contain che", () => {
    expect(cheAsWord("ō chi mēgōyad? chī?")).toBeNull();
    expect(cheAsWord("chek-e musāfiratī")).toBeNull();
  });
});

describe("1pl -īm", () => {
  const stems = new Set(["kard", "raft", "khur"]);
  const isStem = (s: string) => stems.has(s);

  it("catches a present, a copula and a past written -īm", () => {
    expect(verb1plIm("mā mērawīm")).toBe("mērawīm");
    expect(verb1plIm("mā hastīm")).toBe("hastīm");
    expect(verb1plIm("mā kardīm", isStem)).toBe("kardīm");
    expect(verb1plIm("mā namēkhurīm")).toBe("namēkhurīm");
  });

  it("accepts -ēm, and never a noun that ends in -īm", () => {
    expect(verb1plIm("mā mērawēm, hastēm, kardēm", isStem)).toBeNull();
    for (const noun of ["taqsīm", "ta'līm", "qadīm", "tasmīm", "iqlīm", "muhim", "mu'allim"]) {
      expect(verb1plIm(`yak ${noun}`, isStem), noun).toBeNull();
    }
  });
});

/**
 * These four sentences are the whole reason this check is script-aware.
 *
 * The first version asked only whether the Latin contained a long vowel, and
 * on the real lexicon that hid three correct entries from learners while
 * catching 1,208 broken ones. Correct Dari can be entirely short vowels;
 * "no long vowel in the transliteration" is only evidence of a defect when
 * the script says there should have been one.
 */
describe("Iranian-flattened transliteration", () => {
  it("catches a sentence whose long vowels were dropped", () => {
    expect(
      isFlattenedTranslit(
        "Anjam va ghayat-e ensan residan be kamal-e motlaq ast.",
        "انجام و غایت انسان رسیدن به کمال مطلق است.",
      ),
    ).toBe(true);
  });

  it("accepts correct Dari that simply has no long vowel", () => {
    // mardum az sitam khasta shuda-and - every vowel short, and the script
    // agrees. The naive rule called this broken and hid it.
    expect(
      isFlattenedTranslit("mardum az sitam khasta shuda-and.", "مردم از ستم خسته شده‌اند."),
    ).toBe(false);
    expect(
      isFlattenedTranslit("jughd yak paranda-yi shabgard ast.", "جغد یک پرنده شبگرد است."),
    ).toBe(false);
  });

  it("accepts a repaired sentence", () => {
    expect(
      isFlattenedTranslit(
        "anjām wa ghāyat-i insān rasēdan ba kamāl-i mutlaq ast.",
        "انجام و غایت انسان رسیدن به کمال مطلق است.",
      ),
    ).toBe(false);
  });

  it("ignores a word-initial alef, which carries a short vowel", () => {
    // از / است / انسان - the first two are `az` and `ast`, not long vowels.
    expect(scriptLongVowelCount("از است")).toBe(0);
    expect(scriptLongVowelCount("انسان")).toBe(1);
  });

  it("says nothing about strings too short to judge", () => {
    expect(isFlattenedTranslit("ketab", "کتاب")).toBe(false);
  });
});

/**
 * The escape hatch, and why it has to exist.
 *
 * ی is counted as a written long vowel because not counting it costs 21 real
 * detections. But ی also spells the diphthong in `bayn` and `tarafayn`, where
 * nothing is missing - and the script cannot tell the two apart. Rather than
 * blunt the rule, those sentences are named one at a time.
 */
describe("verified short-vowel sentences", () => {
  it("is not flagged once verified by id", () => {
    const target = "عقد بیع بین طرفین منعقد شد.";
    const translit = "aqd-i bay' bayn-i tarafayn mun'aqid shud.";
    // The rule alone cannot see that those three ی are diphthongs.
    expect(isFlattenedTranslit(translit, target)).toBe(true);
    expect(isFlattenedTranslit(translit, target, "lx-4197")).toBe(false);
  });

  it("does not excuse a genuinely flattened sentence that shares an id", () => {
    // The exemption is about one sentence, so a real defect under a listed id
    // would still be wrong - the point is that ids here are verified by hand.
    expect(VERIFIED_SHORT_VOWEL.size).toBeLessThanOrEqual(5);
  });
});

/**
 * The 2sg ending is ی, a long vowel, and the app writes it -ī. The grammar
 * course wrote -i in ~200 places while its own summary said -ī.
 */
describe("bare short -i ending", () => {
  it("catches a 2sg verb written with a short -i", () => {
    expect(bareShortIEnding("tu kujā hasti?")).toBe("hasti");
    expect(bareShortIEnding("agar burawi, ō rā mēbīnī")).toBe("burawi");
  });

  it("accepts the long -ī the app uses", () => {
    expect(bareShortIEnding("tu kujā hastī?")).toBeNull();
    expect(bareShortIEnding("agar biyāyī, khush mēshawam")).toBeNull();
  });

  it("accepts که and the particles built on it, which really end in short i", () => {
    expect(bareShortIEnding("mēdānam ki tu hastī")).toBeNull();
    for (const p of ["balki", "chūnki", "īnki", "agarchi", "hamchunānki", "chi"]) {
      expect(bareShortIEnding(`${p} ō āmad`), p).toBeNull();
    }
  });

  it("still finds a 2sg -i after a particle in the same string", () => {
    expect(bareShortIEnding("mēdānam ki tu hasti")).toBe("hasti");
  });

  it("reads a decomposed ī as long", () => {
    expect(bareShortIEnding("tu hastī")).toBeNull();
  });

  it("ignores a capitalised name and a word that only contains an i", () => {
    expect(bareShortIEnding("nāmash Ali ast")).toBeNull();
    expect(bareShortIEnding("fikr mēkunam")).toBeNull();
  });
});
