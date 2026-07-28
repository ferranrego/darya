import { describe, expect, it } from "vitest";
import { conjugationSurfaces, derivePastStem, type VerbStems } from "./conjugate.ts";
import { ZWNJ } from "./normalize.ts";

function forms(stems: VerbStems): Set<string> {
  return new Set(conjugationSurfaces(stems));
}

describe("derivePastStem", () => {
  it("strips the final ن of دن/تن infinitives", () => {
    expect(derivePastStem("کردن")).toBe("کرد");
    expect(derivePastStem("گفتن")).toBe("گفت");
    expect(derivePastStem("نمودن")).toBe("نمود");
  });

  it("rejects non-infinitives that merely end in ن", () => {
    expect(derivePastStem("همزمان")).toBeNull();
    expect(derivePastStem("نان")).toBeNull();
  });
});

describe("conjugationSurfaces", () => {
  const kardan = forms({ pastStem: "کرد", presentStem: "کن" });

  it("generates the full کردن paradigm", () => {
    for (const f of [
      "کردم", "کردی", "کرد", "کردیم", "کردید", "کردند", // simple past
      "نکردم", "نکردند", // negative past
      `می${ZWNJ}کردم`, `نمی${ZWNJ}کرد`, // imperfect
      "کرده", `کرده${ZWNJ}ام`, `کرده${ZWNJ}اند`, `نکرده${ZWNJ}ام`, // perfect
      `می${ZWNJ}کنم`, `می${ZWNJ}کند`, `نمی${ZWNJ}کنیم`, // present
      "بکنم", "کنم", "نکند", // subjunctive + bare + negative
      "بکن", "بکنید", "نکن", "نکنید", // imperative
    ]) {
      expect(kardan, f).toContain(f);
    }
  });

  it("emits both ZWNJ and ZWNJ-less spellings", () => {
    expect(kardan).toContain(`می${ZWNJ}کنم`);
    expect(kardan).toContain("میکنم");
    expect(kardan).toContain(`کرده${ZWNJ}ام`);
    expect(kardan).toContain("کردهام");
  });

  it("applies epenthetic ی for گو (lexical) but not رو", () => {
    const guftan = forms({ pastStem: "گفت", presentStem: "گو" });
    expect(guftan).toContain(`می${ZWNJ}گویم`);
    expect(guftan).toContain(`می${ZWNJ}گویند`);
    expect(guftan).toContain("بگویم");
    expect(guftan).toContain("بگو"); // imperative keeps the bare stem
    expect(guftan).toContain("بگویید");

    const raftan = forms({ pastStem: "رفت", presentStem: "رو" });
    expect(raftan).toContain(`می${ZWNJ}روم`); // NOT می‌رویم as 1sg
    expect(raftan).toContain("بروم");
    expect(raftan).toContain("برو");
    expect(raftan).not.toContain(`می${ZWNJ}رویی`);
  });

  it("handles آ-initial stems: بیا، نیا، نیامد", () => {
    const amadan = forms({ pastStem: "آمد", presentStem: "آ" });
    expect(amadan).toContain("نیامدم"); // negative past mutates ن+آ
    expect(amadan).toContain(`می${ZWNJ}آیم`);
    expect(amadan).toContain("بیایم");
    expect(amadan).toContain("بیا");
    expect(amadan).toContain("نیا");
    expect(amadan).toContain(`نیامده${ZWNJ}اند`);
  });

  it("داشتن: bare present without می, no imperative", () => {
    const dashtan = forms({ pastStem: "داشت", presentStem: "دار", noMiPresent: true });
    expect(dashtan).toContain("دارم");
    expect(dashtan).toContain("ندارند");
    expect(dashtan).not.toContain(`می${ZWNJ}دارم`);
    expect(dashtan).not.toContain("بدار");
    expect(dashtan).toContain("داشتم"); // past system unaffected
    expect(dashtan).toContain(`داشته${ZWNJ}ام`);
  });

  it("prefix verbs infix می and ن after the prefix", () => {
    const bargashtan = forms({ pastStem: "گشت", presentStem: "گرد", prefix: "بر" });
    expect(bargashtan).toContain("برگشتم");
    expect(bargashtan).toContain("برنگشتم"); // NOT نبرگشتم
    expect(bargashtan).toContain(`برمی${ZWNJ}گردم`);
    expect(bargashtan).toContain(`برنمی${ZWNJ}گردد`);
    expect(bargashtan).toContain("برگردم"); // subjunctive without ب
    expect(bargashtan).toContain("برگرد"); // imperative
    expect(bargashtan).toContain(`برگشته${ZWNJ}ام`);
    expect(bargashtan).not.toContain("ببرگردم");
  });

  it("past-system only when presentStem is null", () => {
    const f = forms({ pastStem: "نهفت", presentStem: null });
    expect(f).toContain("نهفتم");
    expect(f).toContain(`نهفته${ZWNJ}اند`);
    for (const surface of f) {
      expect(surface).not.toMatch(/^ب/);
    }
  });
});
