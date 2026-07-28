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

  it("no UI file hardcodes a brand name", async () => {
    // The Catalan app shipped with "Darya" on its welcome screen because the
    // name was written inline. Brand text must come from the profile.
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const root = join(import.meta.dirname, "..", "..");
    const brands = Object.values(PROFILES).map((x) => x.brand.appName);
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
            // Comments may name a brand; rendered text may not.
            if (code.startsWith("*") || code.startsWith("//") || code.startsWith("/*")) return;
            for (const brand of brands) {
              if (new RegExp(`\\b${brand}\\b`).test(code)) {
                offenders.push(`${full.slice(root.length + 1)}:${i + 1} (${brand})`);
              }
            }
          });
      }
    };
    walk(join(root, "app"));
    walk(join(root, "components"));
    expect(offenders, "brand text must come from profile.brand").toEqual([]);
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
