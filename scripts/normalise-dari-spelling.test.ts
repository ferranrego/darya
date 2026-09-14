import { describe, expect, it } from "vitest";

import { dariWords, mapWords, normaliseToken, type Ctx } from "./normalise-dari-spelling.ts";

/**
 * The sweep decides each word with its own Dari as evidence. These pin the
 * directions a plain `e` → `i` regex would get wrong: a flattened majhul ē,
 * the ezafe, a final ه, a loanword, a noun in -īm, and prose.
 */
const ctx: Ctx = {
  presentStems: [
    { latin: "dih", dari: "ده" },
    { latin: "zan", dari: "زن" },
    { latin: "raw", dari: "رو" },
  ],
  isVerbStem: (s) => ["kard", "raft", "raw", "dih"].includes(s),
  verbForms: new Set(["بده", "بزند"]),
  nonVerbTargets: new Set(["بدهی", "برنج"]),
};
const n = (w: string, dari?: string) => normaliseToken(w, dari, ctx).out;

describe("normaliseToken", () => {
  it("writes the kasra i and keeps the ezafe", () => {
    expect(n("ketāb", "کتاب")).toBe("kitāb");
    expect(n("ketāb-e", "کتاب")).toBe("kitāb-e");
    expect(n("jāme'a-ye", "جامعه")).toBe("jāmi'a-ye");
    expect(n("Emrōz", "امروز")).toBe("Imrōz");
  });

  it("restores a flattened majhul ē instead of teaching the Iranian i", () => {
    expect(n("mekonad", "میکند")).toBe("mēkonad");
    expect(n("pesh", "پیش")).toBe("pēsh");
    expect(n("se", "سه")).toBe("sē");
  });

  it("does not mistake an -i suffix for a missing ē", () => {
    expect(n("tejāri", "تجاری")).toBe("tijāri");
  });

  it("writes a final ه as -a", () => {
    expect(n("saze", "سازه")).toBe("saza");
  });

  it("writes چه chi and spoken چی chī", () => {
    expect(n("che", "چه")).toBe("chi");
    expect(n("che", "چی")).toBe("chī");
    expect(n("chetōr", "چطور")).toBe("chitōr");
  });

  it("writes the 1pl -ēm on verbs only", () => {
    expect(n("kardim", "کردیم")).toBe("kardēm");
    expect(n("taqsīm", "تقسیم")).toBe("taqsīm");
    expect(n("qadīm", "قدیم")).toBe("qadīm");
  });

  it("writes the verbal prefix bu-, but not on a noun that looks like one", () => {
    expect(n("bedeh", "بده")).toBe("budih");
    expect(n("bezanad", "بزند")).toBe("buzanad");
    expect(n("bedihi", "بدهی")).toBe("bidihi");
    expect(n("berenj", "برنج")).toBe("birinj");
  });

  it("leaves loanwords and majhul ē alone", () => {
    expect(n("hotel", "هتل")).toBe("hotel");
    expect(n("model-hā", "مدلها")).toBe("model-hā");
    expect(n("mērawēm", "میرویم")).toBe("mērawēm");
  });

  it("is idempotent", () => {
    for (const [w, d] of [["ketāb-e", "کتاب"], ["mekonad", "میکند"], ["che", "چه"], ["saze", "سازه"]]) {
      const once = n(w, d);
      expect(n(once, d)).toBe(once);
    }
  });

  it("without Dari, refuses to guess a me-/be- word or a final e", () => {
    expect(normaliseToken("mekonad", undefined, ctx).skip).toBeTruthy();
    expect(normaliseToken("saze", undefined, ctx).skip).toBeTruthy();
    expect(n("ketāb")).toBe("kitāb");
  });
});

/**
 * The philologist's review findings, each on both the Iranian original and
 * the already-swept i form, since the script must repair content it swept.
 */
describe("review repairs", () => {
  it("R1: Arabic taf'āl masdars keep a", () => {
    expect(n("te'dād-e", "تعداد")).toBe("ta'dād-e");
    expect(n("ti'dād-e", "تعداد")).toBe("ta'dād-e");
    expect(n("tikrār", "تکرار")).toBe("takrār");
    expect(n("tikya", "تکیه")).toBe("takya");
    expect(n("isti'māl", "استعمال")).toBe("isti'māl");
    expect(n("tijāri", "تجاری")).toBe("tijāri");
  });

  it("R2: the agent suffix is -anda, and zinda is not one", () => {
    expect(n("nawīsinda", "نویسنده")).toBe("nawīsanda");
    expect(n("masraf-konindagān", "مصرف‌کنندگان")).toBe("masraf-kunandagān");
    expect(n("nishān-dihonda-ye", "نشان‌دهنده")).toBe("nishān-dihanda-ye");
    expect(n("parinda", "پرنده")).toBe("paranda");
    expect(n("zinda", "زنده")).toBe("zinda");
    expect(n("zenda", "زنده")).toBe("zinda");
  });

  it("R3: darakht and the other Persian a/u words", () => {
    expect(n("derakht-e", "درخت")).toBe("darakht-e");
    expect(n("dirakhtān", "درختان")).toBe("darakhtān");
    expect(n("nimud-e", "نمود")).toBe("namūd-e");
    expect(n("sarnivisht-e", "سرنوشت")).toBe("sarnawisht-e");
  });

  it("R4: counts a ی inside the root even when an ezafe or -i is present", () => {
    // the cause: the old count let -ye and a bare -i cover the root's ی
    expect(n("be-rawiya-ye", "بی‌رویه")).toBe("bē-rawiya-ye");
    expect(n("pichesh", "پیچش")).toBe("pēchish");
    expect(n("ketāb-hā-ye", "کتابهای")).toBe("kitāb-hā-ye");
  });

  it("R6: bi-/ba- verb prefixes become bu-, nouns and biyā stay", () => {
    const stems: Ctx = { ...ctx, presentStems: [...ctx.presentStems, { latin: "dān", dari: "دان" }] };
    expect(normaliseToken("bidānam", "بدانم", stems).out).toBe("budānam");
    expect(normaliseToken("badihēd", "بدهید", stems).out).toBe("budihēd");
    expect(n("bidihī", "بدهی")).toBe("bidihī");
    expect(n("biyā", "بیا")).toBe("biyā");
  });

  it("loanwords converge on one spelling", () => {
    expect(n("telefōn", "تلفون")).toBe("tēlifōn");
    expect(n("sistam-e", "سیستم")).toBe("sīstim-e");
    expect(n("resturān", "رستوران")).toBe("restorān");
    expect(n("estāndārd", "استاندارد")).toBe("istāndārd");
  });

  it("chē for چه is chi; mēgērad is mēgīrad", () => {
    expect(n("chē", "چه")).toBe("chi");
    expect(n("mēgērad", "میگیرد")).toBe("mēgīrad");
  });
});

describe("helpers", () => {
  it("joins a detached می to its verb so the words align", () => {
    expect(dariWords("ما می رویم.")).toEqual(["ما", "میرویم"]);
  });

  it("leaves a quoted ezafe alone when rewriting words", () => {
    expect(mapWords("ketāb + -e", (w) => w.replace("e", "i"))).toBe("kitāb + -e");
  });
});
