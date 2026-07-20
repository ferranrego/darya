"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useAlphabetProgress, useProfile, useUserWords } from "@/lib/queries/hooks";

export default function StatsPage() {
  const { data: profile } = useProfile();
  const { data: words } = useUserWords();
  const { data: alphabet } = useAlphabetProgress();

  if (!profile) return null;

  const totalWords = words?.length ?? 0;
  const knownCount = words?.filter((w) => w.status === "known").length ?? 0;
  const learningCount = words?.filter((w) => w.status === "learning").length ?? 0;
  
  const completedAlphabetUnits = alphabet?.filter(u => u.completed_at !== null).length ?? 0;

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
        <div className="mt-4 pt-4 border-t border-line">
          <div className="flex justify-between items-end mb-2">
            <span className="text-[13px] font-medium text-ink-soft">Total vocabulary size</span>
            <span className="text-[15px] font-semibold">{totalWords}</span>
          </div>
          <div className="h-2 w-full bg-line rounded-full overflow-hidden flex">
            {totalWords > 0 && (
              <>
                <div 
                  className="h-full bg-lapis" 
                  style={{ width: `${(knownCount / totalWords) * 100}%` }} 
                />
                <div 
                  className="h-full bg-saffron" 
                  style={{ width: `${(learningCount / totalWords) * 100}%` }} 
                />
              </>
            )}
          </div>
        </div>
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
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-[14px] text-ink-soft">Best Streak</span>
            <span className="text-[15px] font-medium">{profile.streak_best} days</span>
          </div>
        </div>
      </section>
    </div>
  );
}
