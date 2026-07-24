import { levels } from "@/lib/content/load";
import type { ProfileRow } from "@/lib/db/types";

/**
 * Projected time to the next CEFR level, from the learner's known-word pace.
 * Mirrors the forecast on the Stats page (words/day since onboarding vs. the
 * next level's entryKnownWords threshold), packaged for reuse on Home.
 */
export interface LevelForecast {
  /** CEFR code of the current level, e.g. "A1". */
  currentCefr: string;
  /** CEFR code of the next level, e.g. "A2". Null at the top level. */
  nextCefr: string | null;
  wordsToGo: number;
  /** Estimated calendar days to reach the next level, or null when unknowable. */
  daysToGo: number | null;
  /** Fraction of the way from this level's threshold to the next, 0–1. */
  progress: number;
  status: "forecast" | "ready" | "need-data" | "max";
}

const cefr = (hint: string) => hint.replace(/^pre/, "Pre");

export function levelForecast(
  profile: Pick<ProfileRow, "level_estimate" | "onboarded_at" | "created_at"> | undefined,
  knownCount: number,
): LevelForecast | null {
  if (!profile) return null;

  const idx = levels.findIndex((l) => l.id === profile.level_estimate);
  const current = idx >= 0 ? levels[idx] : levels[0];
  const next = idx >= 0 && idx < levels.length - 1 ? levels[idx + 1] : null;
  const currentCefr = cefr(current.cefrHint);

  if (!next) {
    return { currentCefr, nextCefr: null, wordsToGo: 0, daysToGo: null, progress: 1, status: "max" };
  }

  const nextCefr = cefr(next.cefrHint);
  const span = Math.max(1, next.entryKnownWords - current.entryKnownWords);
  const progress = Math.min(1, Math.max(0, (knownCount - current.entryKnownWords) / span));
  const wordsToGo = Math.max(0, next.entryKnownWords - knownCount);

  if (wordsToGo === 0) {
    return { currentCefr, nextCefr, wordsToGo: 0, daysToGo: null, progress: 1, status: "ready" };
  }

  const startTs = profile.onboarded_at
    ? new Date(profile.onboarded_at).getTime()
    : new Date(profile.created_at).getTime();
  const daysSinceStart = Math.max(1, (Date.now() - startTs) / 86_400_000);
  const wordsPerDay = knownCount / daysSinceStart;
  const daysToGo = wordsPerDay > 0 ? Math.ceil(wordsToGo / wordsPerDay) : null;

  if (daysToGo === null || daysToGo >= 3650) {
    return { currentCefr, nextCefr, wordsToGo, daysToGo: null, progress, status: "need-data" };
  }
  return { currentCefr, nextCefr, wordsToGo, daysToGo, progress, status: "forecast" };
}
