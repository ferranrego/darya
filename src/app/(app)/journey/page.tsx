"use client";

import { JourneyMap } from "@/components/ui/journey-map";
import { alphabetCourse } from "@/lib/content/load";
import {
  useAlphabetProgress,
  useGrammarProgress,
  useProfile,
} from "@/lib/queries/hooks";

export default function JourneyPage() {
  const { data: profile } = useProfile();
  const { data: alphaProgress } = useAlphabetProgress();
  const { data: grammarProgress } = useGrammarProgress();

  const completedUnits = alphaProgress?.filter((u) => u.completed_at).length ?? 0;
  const totalUnits = alphabetCourse.units.length;

  const completedRows = new Set(
    grammarProgress?.filter((l) => l.completed_at).map((l) => l.lesson_id) ?? []
  );

  return (
    <div className="flex flex-col min-h-[calc(100vh-100px)]">
      <header className="sticky top-0 z-30 flex items-start justify-between p-4 bg-paper/80 backdrop-blur-xl border-b border-line/30 shadow-[0_4px_16px_rgba(31,26,23,0.03)] -mx-4 px-8 pt-6">
        <div>
          <h1 className="text-[26px] font-semibold tracking-tight">Your Journey</h1>
          <p className="text-[14px] text-ink-soft">
            See how far you&apos;ve come
          </p>
        </div>
      </header>

      <main className="flex-1 w-full relative pt-4 pb-20">
        <JourneyMap
          alphabetCompletedUnits={completedUnits}
          totalAlphabetUnits={totalUnits}
          grammarCompletedLessonIds={completedRows}
          userLevelEstimate={profile?.level_estimate ?? "L1"}
          canReadScript={profile?.can_read_script ?? null}
        />
      </main>
    </div>
  );
}
