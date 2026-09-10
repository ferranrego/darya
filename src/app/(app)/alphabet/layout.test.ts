import { describe, expect, it, vi } from "vitest";

/**
 * The alphabet course is gated on `capabilities.scriptCourse`, and this asserts
 * both directions of that gate against the real layout module.
 *
 * It lives beside the route rather than in `lang/capabilities.test.ts` because
 * it imports the route: a language with no script course deletes this whole
 * tree, and a shared test that resolves a path into it fails `tsc` there even
 * when the test itself is skipped. Deleted with the feature, it cannot.
 */
describe("alphabet route guard", () => {
  async function loadLayout(scriptCourse: boolean) {
    vi.resetModules();
    const notFound = vi.fn(() => {
      throw new Error("NEXT_NOT_FOUND");
    });
    vi.doMock("next/navigation", () => ({ notFound }));
    vi.doMock("@/lib/lang", () => ({
      profile: { capabilities: { transliteration: true, scriptCourse, fontPicker: true } },
    }));
    const mod = await import("./layout.tsx");
    return { layout: mod.default, notFound };
  }

  it("404s the whole alphabet tree when the language has no script course", async () => {
    const { layout, notFound } = await loadLayout(false);
    expect(() => layout({ children: null })).toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  it("renders normally when the language has one (today: Dari)", async () => {
    const { layout, notFound } = await loadLayout(true);
    expect(() => layout({ children: null })).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
  });
});

describe("no component hardcodes a language's script direction", () => {
  /**
   * `dir` and `lang` must come from the active profile, never from a literal.
   *
   * A hardcoded `dir="rtl"` around Catalan does not merely look odd: on a flex
   * row it reverses the visual order of the words outright, and inside a
   * paragraph it moves the segments and trailing punctuation. Measured in a
   * browser, the spotError row rendered "El llibre està a la taula." as
   * "taula. la a està llibre El", and the fillBlank paragraph put the tail of
   * the sentence in front of its own blank. 153 of the 201 Catalan grammar
   * exercises were affected, and nothing failed - typecheck, tests, the content
   * validators and the Perso-Arabic leak guard are all blind to an attribute.
   *
   * The alphabet tree is exempt: it exists only to teach a non-Latin script and
   * is 404'd wholesale for a language without one (see the guard above).
   */
  it("has no literal dir=rtl or lang=prs outside the alphabet route", async () => {
    const { execSync } = await import("node:child_process");
    const { join } = await import("node:path");
    const src = join(import.meta.dirname, "..", "..");

    const hits = execSync(
      `grep -rn 'dir="rtl"\\|lang="prs"' ${JSON.stringify(src)} --include='*.tsx' || true`,
      { encoding: "utf8" },
    )
      .split("\n")
      .filter((l) => l.trim() && !l.includes("/alphabet/"));

    expect(hits, `use dir={profile.dir} / lang={profile.code}:\n${hits.join("\n")}`).toEqual([]);
  });
});
