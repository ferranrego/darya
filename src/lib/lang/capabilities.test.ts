import { describe, expect, it, vi } from "vitest";
import { PROFILES, profile } from "./index.ts";

/**
 * Capability gating is what lets one codebase serve languages with genuinely
 * different feature sets. These assert both directions:
 *
 *   * Dari declares every capability, so Phase 4's gating must be a no-op for
 *     the app that exists today - the failure mode to fear is silently hiding
 *     a working feature;
 *   * a profile that declines a capability actually turns it off, which is the
 *     only reason the gating exists.
 */

describe("language profiles", () => {
  it("every registered profile is internally consistent", () => {
    for (const [code, p] of Object.entries(PROFILES)) {
      expect(p.code, `${code}: code must match its registry key`).toBe(code);
      expect(p.dir === "ltr" || p.dir === "rtl", `${code}: dir`).toBe(true);
      expect(p.ttsLocale.length, `${code}: ttsLocale`).toBeGreaterThan(0);
      expect(p.ttsVoicePrefixes.length, `${code}: ttsVoicePrefixes`).toBeGreaterThan(0);
      // letter-spacing goes through a CSS var, where a bare `0` is dropped as
      // invalid at computed-value time. A keyword is fine; a bare number is not.
      expect(p.letterSpacing, `${code}: letterSpacing must be a keyword or carry a unit`)
        .toMatch(/^(normal|-?[\d.]+[a-z%]+)$/);
      for (const fn of ["normalize", "matchKey", "tokenize", "buildIndex"] as const) {
        expect(typeof p.text[fn], `${code}: text.${fn}`).toBe("function");
      }
      expect(p.prompts.teacher.length, `${code}: prompts.teacher`).toBeGreaterThan(0);
      expect(p.prompts.scenarios.length, `${code}: prompts.scenarios`).toBeGreaterThan(0);
      // Brand is what a deployment ships under; a missing field would render as
      // "undefined" in the title bar and the install manifest.
      for (const f of ["appName", "nativeName", "tagline", "description", "mascotName"] as const) {
        expect(p.brand[f]?.length, `${code}: brand.${f}`).toBeGreaterThan(0);
      }
    }
  });

  it("Dari keeps every capability, so the gating changes nothing for it", () => {
    expect(PROFILES.prs.capabilities).toEqual({
      transliteration: true,
      scriptCourse: true,
      fontPicker: true,
    });
    expect(PROFILES.prs.dir).toBe("rtl");
  });

  it("Catalan turns off exactly the script-specific features", () => {
    expect(PROFILES.ca.capabilities).toEqual({
      transliteration: false,
      scriptCourse: false,
      fontPicker: false,
    });
    expect(PROFILES.ca.dir).toBe("ltr");
    expect(PROFILES.ca.ttsLocale).toBe("ca");
  });

  it("no UI file hardcodes brand, language name or target-language text", async () => {
    // Three separate leaks reached production, each caught by a user rather
    // than by a test:
    //   1. brand      - Riera's welcome screen said "Darya"
    //   2. language   - "You'll learn Dari by reading it." in the Catalan app
    //   3. script     - خوش آمدید greeted Catalan learners
    // All three must come from the profile, so all three are checked here.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join, sep } = await import("node:path");
    const root = join(import.meta.dirname, "..", "..");

    const brands = Object.values(PROFILES).map((p) => p.brand.appName);
    const languages = Object.values(PROFILES).map((p) => p.name);
    // Any script that is not the Latin alphabet the UI itself is written in.
    const NON_LATIN = /[\u0600-\u06FF\u0750-\u077F\u0400-\u04FF\u4E00-\u9FFF]/;
    const offenders: string[] = [];

    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) {
          if (name !== "lang") walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(name) || name.includes(".test.")) continue;
        readFileSync(full, "utf8")
          .split("\n")
          .forEach((line, i) => {
            const code = line.trim();
            if (code.startsWith("*") || code.startsWith("//") || code.startsWith("/*")) return;
            const where = `${full.slice(root.length + 1)}:${i + 1}`;

            // Two narrow, justified exemptions:
            //  - the alphabet route tree exists only to teach a non-Latin
            //    script and 404s wholesale when capabilities.scriptCourse is
            //    off, so a glyph there can never reach a Catalan learner;
            //  - a regex literal is a *matcher*, not rendered text. The cloze
            //    placeholder pattern includes a tatweel so it can strip one if
            //    the model emits it; it simply never matches Latin input.
            const inGatedAlphabetRoute = full.includes(`${sep}alphabet${sep}`);
            const isRegexLiteral = /=\s*\/|\.match\(\/|\.test\(\/|\.replace\(\//.test(code);
            if (inGatedAlphabetRoute || isRegexLiteral) return;
            for (const b of brands) {
              if (new RegExp(`\\b${b}\\b`).test(code)) offenders.push(`${where} brand "${b}"`);
            }
            for (const l of languages) {
              if (new RegExp(`\\b${l}\\b`).test(code)) offenders.push(`${where} language "${l}"`);
            }
            if (NON_LATIN.test(code)) offenders.push(`${where} target-language text`);
          });
      }
    };
    walk(join(root, "app"));
    walk(join(root, "components"));
    expect(offenders, "must come from the language profile").toEqual([]);
  });

  it("each profile ships a distinct brand", () => {
    const names = Object.values(PROFILES).map((p) => p.brand.appName);
    expect(new Set(names).size, "two deployments must not share a name").toBe(names.length);
  });

  it("resolves a profile for the active build", () => {
    expect(profile.code).toBe(process.env.NEXT_PUBLIC_TARGET_LANG ?? "prs");
  });
});

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
    const mod = await import("../../app/(app)/alphabet/layout.tsx");
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
