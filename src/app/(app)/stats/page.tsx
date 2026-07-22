"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useAlphabetProgress, useProfile, useUserWords } from "@/lib/queries/hooks";
import { levels } from "@/lib/content/load";
import { VocabChart } from "./vocab-chart";
import { ActivityHeatmap } from "./heatmap";

export default function StatsPage() {
  const { data: profile } = useProfile();
  const { data: words } = useUserWords();
  const { data: alphabet } = useAlphabetProgress();

  if (!profile) return null;

  const totalWords = words?.length ?? 0;
  const knownCount = words?.filter((w) => w.status === "known").length ?? 0;
  const learningCount = words?.filter((w) => w.status === "learning").length ?? 0;
  
  const completedAlphabetUnits = alphabet?.filter(u => u.completed_at !== null).length ?? 0;

  // Forecast Logic
  const startTimestamp = profile.onboarded_at ? new Date(profile.onboarded_at).getTime() : new Date(profile.created_at).getTime();
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
        <VocabChart knownCount={knownCount} learningCount={learningCount} startTimestamp={startTimestamp} />
      </section>

      <section className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-[14px] font-medium text-ink-soft mb-1">Total Experience</h2>
          <p className="text-[24px] font-bold">{profile.xp} <span className="text-[14px] font-normal text-ink-soft">XP</span></p>
        </div>
        <div className="rounded-2xl border border-line bg-surface p-5">
          <h2 className="text-[14px] font-medium text-ink-soft mb-1">Alphabet Mastery</h2>
          <p className="text-[24px] font-bold">{completedAlphabetUnits} <span className="text-[14px] font-normal text-ink-soft">units</span></p>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface p-5">
        <h2 className="text-[16px] font-semibold mb-4">Reading Journey</h2>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-ink-soft">Current Level Estimate</span>
            <span className="text-[15px] font-medium px-2 py-0.5 bg-lapis-soft text-lapis rounded-md">
              {profile.level_estimate.replace("L", "Level ")}
              {currentLevelIdx >= 0 ? ` (${levels[currentLevelIdx].cefrHint === 'pre-A1' ? 'pre-A1' : levels[currentLevelIdx].cefrHint.toUpperCase()})` : ""}
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
