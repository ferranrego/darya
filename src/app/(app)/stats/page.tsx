"use client";

import { ChevronLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useAlphabetProgress, useProfile, useWordCounts } from "@/lib/queries/hooks";
import { levelLabel, levels } from "@/lib/content/levels";
import { profile as lang } from "@/lib/lang";

/**
 * Charts load after the numbers, not before them.
 *
 * recharts is a 381 KB chunk and the heatmap library is another, and both were
 * static imports, so the Stats tab's figures waited on chart code the learner
 * reads last. Neither renders anything meaningful on the server. The chart's
 * placeholder is its exact box (`h-48 mt-6`), so nothing moves when it arrives.
 */
const VocabChart = dynamic(() => import("./vocab-chart").then((m) => m.VocabChart), {
  ssr: false,
  loading: () => <div className="mt-6 h-48 w-full" />,
});
const ActivityHeatmap = dynamic(() => import("./heatmap").then((m) => m.ActivityHeatmap), {
  ssr: false,
});

export default function StatsPage() {
  const { data: profile } = useProfile();
  const { data: counts } = useWordCounts();
  const { data: alphabet } = useAlphabetProgress();

  if (!profile) return null;

  // Curricular only: the level forecast measures progress through the
  // frequency-ordered lexicon, which an imported article is not part of.
  const knownCount = counts?.known ?? 0;
  const learningCount = counts?.learning ?? 0;
  
  const completedAlphabetUnits = alphabet?.filter(u => u.completed_at !== null).length ?? 0;

  // Forecast Logic
  const startTimestamp = profile.onboarded_at ? new Date(profile.onboarded_at).getTime() : new Date(profile.created_at).getTime();
  // eslint-disable-next-line react-hooks/purity
  const daysSinceStart = Math.max(1, (Date.now() - startTimestamp) / (1000 * 60 * 60 * 24));
  const wordsPerDay = knownCount / daysSinceStart;

  const currentLevelIdx = levels.findIndex((l) => l.id === profile.level_estimate);
  const nextLevel = currentLevelIdx >= 0 && currentLevelIdx < levels.length - 1 ? levels[currentLevelIdx + 1] : null;
  const wordsToNextLevel = nextLevel ? Math.max(0, nextLevel.entryKnownWords - knownCount) : 0;
  
  const daysToNextLevel = (wordsPerDay > 0 && nextLevel && wordsToNextLevel > 0) ? Math.ceil(wordsToNextLevel / wordsPerDay) : null;
  
  let forecastText = "Max level reached!";
  if (nextLevel) {
    if (wordsToNextLevel === 0) {
      forecastText = "Ready for promotion!";
    } else if (daysToNextLevel !== null && daysToNextLevel < 365 * 10) {
      // eslint-disable-next-line react-hooks/purity
      const forecastDate = new Date(Date.now() + daysToNextLevel * 24 * 60 * 60 * 1000);
      const isCurrentYear = forecastDate.getFullYear() === new Date().getFullYear();
      forecastText = `${forecastDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: isCurrentYear ? undefined : 'numeric' })} (${daysToNextLevel} day${daysToNextLevel === 1 ? '' : 's'})`;
    } else {
      forecastText = "Learn more words to forecast";
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center gap-3 pt-2">
        <Link href="/profile" className="text-ink-soft hover:text-ink transition-colors">
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-[22px] font-semibold tracking-tight">Your Stats</h1>
      </header>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[16px] font-semibold mb-4">Vocabulary Progress</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[28px] font-bold text-lapis">{knownCount}</p>
            <p className="text-[13px] text-ink-soft">Known words</p>
          </div>
          <div>
            <p className="text-[28px] font-bold text-saffron">{learningCount}</p>
            <p className="text-[13px] text-ink-soft">Learning words</p>
          </div>
        </div>
        {/* VocabChart renders nothing for an empty vocabulary; checking here too
            keeps its loading placeholder from flashing an empty box. */}
        {(knownCount > 0 || learningCount > 0) && (
          <VocabChart knownCount={knownCount} learningCount={learningCount} startTimestamp={startTimestamp} />
        )}
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-[14px] font-medium text-ink-soft mb-1">Total Experience</h2>
          <p className="text-[24px] font-bold">{profile.xp} <span className="text-[14px] font-normal text-ink-soft">XP</span></p>
        </div>
        {lang.capabilities.scriptCourse && (
          <div className="rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-[14px] font-medium text-ink-soft mb-1">Alphabet Mastery</h2>
            <p className="text-[24px] font-bold">{completedAlphabetUnits} <span className="text-[14px] font-normal text-ink-soft">units</span></p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[16px] font-semibold mb-4">Reading Journey</h2>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-ink-soft">Current Level Estimate</span>
            <span className="text-[15px] font-medium px-2 py-0.5 bg-lapis-soft text-lapis rounded-md">
              {levelLabel(profile.level_estimate)}
            </span>
          </div>

          {nextLevel && (
            <div className="flex justify-between items-center">
              <span className="text-[14px] text-ink-soft">Next Level Forecast</span>
              <span className="text-[15px] font-medium text-ink-soft">
                {forecastText}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center">
            <span className="text-[14px] text-ink-soft">Best Streak</span>
            <span className="text-[15px] font-medium">{profile.streak_best} days</span>
          </div>
        </div>
        <ActivityHeatmap />
      </section>
    </div>
  );
}
