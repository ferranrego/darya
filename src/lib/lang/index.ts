import { ca } from "./ca/index.ts";
import { prs } from "./prs/index.ts";
import type { LanguageProfile } from "./types.ts";

export type {
  LanguageCapabilities,
  LanguagePrompts,
  LanguageProfile,
  LanguageText,
  LexiconIndex,
} from "./types.ts";

/**
 * Every target language this codebase can build. Adding one is: implement the
 * profile, add it here, add `content/<code>/`, and point a second deployment at
 * it with NEXT_PUBLIC_TARGET_LANG.
 */
export const PROFILES = { prs, ca } satisfies Record<string, LanguageProfile>;

export type TargetLang = keyof typeof PROFILES;

const DEFAULT_LANG: TargetLang = "prs";

function resolveProfile(): LanguageProfile {
  const code = process.env.NEXT_PUBLIC_TARGET_LANG;
  if (!code) return PROFILES[DEFAULT_LANG];
  if (code in PROFILES) return PROFILES[code as TargetLang];
  throw new Error(
    `NEXT_PUBLIC_TARGET_LANG="${code}" is not a known language (have: ${Object.keys(PROFILES).join(", ")})`,
  );
}

/**
 * The language this build teaches. Resolved once at module load from
 * NEXT_PUBLIC_TARGET_LANG, so it is a build-time constant on both server and
 * client - one deployment only ever serves one language, which keeps each
 * database single-language and each brand distinct.
 */
export const profile: LanguageProfile = resolveProfile();
