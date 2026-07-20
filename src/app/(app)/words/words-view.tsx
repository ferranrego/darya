"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { lexemeById, levels } from "@/lib/content/load";
import { useUserWords } from "@/lib/queries/hooks";
import { KNOWN_STABILITY_DAYS } from "@/lib/srs/scheduler";

export function WordsView() {
  const { data: words } = useUserWords();
  const [filter, setFilter] = useState<"learning" | "known">("learning");

  const cefrLevels = useMemo(() => {
    return levels.filter((l) => ["A1", "A2", "B1", "B2"].includes(l.cefrHint));
  }, []);

  const knownCount = useMemo(() => {
    if (!words) return 0;
    return words.filter((w) => w.status === "known").length;
  }, [words]);

  const filteredWords = useMemo(() => {
    if (!words) return [];
    return words
      .filter((w) => w.status === filter)
      .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }, [words, filter]);

  return (
    <div className="flex flex-col gap-8">
      <header className="pt-2">
        <h1 className="text-[26px] font-semibold tracking-tight">Your Words</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          {knownCount} words known · Track your progress towards CEFR levels
        </p>
      </header>

      {/* Progress Section */}
      <section className="flex flex-col gap-5 mt-4 mb-3">
        {(() => {
          // Find Active Level
          const activeIndex = cefrLevels.findIndex((l) => knownCount < l.entryKnownWords);
          const isAllComplete = activeIndex === -1;
          const currentIndex = isAllComplete ? cefrLevels.length - 1 : activeIndex;
          const activeLevel = cefrLevels[currentIndex];
          const progress = Math.min(100, Math.max(0, Math.round((knownCount / activeLevel.entryKnownWords) * 100)));

          return (
            <>
              {/* Horizontal Mini-Stepper */}
              <div className="flex items-center justify-between px-1">
                {cefrLevels.map((level, index) => {
                  const isCompleted = knownCount >= level.entryKnownWords;
                  const isActive = index === currentIndex;
                  
                  return (
                    <div key={level.id} className="flex items-center flex-1 last:flex-none">
                      <div className={`relative flex items-center justify-center shrink-0 rounded-full transition-all duration-300 ${
                        isCompleted 
                          ? "h-6 w-6 bg-sabz text-white shadow-sm" 
                          : isActive 
                            ? "h-7 px-3.5 border-2 border-lapis bg-lapis-soft/20 text-lapis text-[13px] font-bold shadow-sm" 
                            : "h-4 w-4 bg-line text-transparent"
                      }`}>
                         {isCompleted ? <Check size={14} /> : isActive ? level.cefrHint : null}
                      </div>
                      {index < cefrLevels.length - 1 && (
                        <div className={`h-[2px] w-full mx-2 md:mx-3 rounded-full ${isCompleted ? "bg-sabz" : "bg-line"}`} />
                      )}
                    </div>
                  );
                })}
              </div>
              
              {/* Focus Hero Card */}
              <div className={`relative overflow-hidden rounded-3xl border p-5 md:p-6 transition-all duration-500 ${
                isAllComplete 
                  ? "border-sabz-soft bg-sabz-soft/10 shadow-[0_8px_30px_rgba(34,197,94,0.12)]" 
                  : "border-lapis/20 bg-surface shadow-[0_8px_30px_rgba(59,130,246,0.08)]"
              }`}>
                {/* Decorative background element */}
                <div className={`absolute -top-24 -right-24 w-48 h-48 rounded-full blur-3xl opacity-20 pointer-events-none ${isAllComplete ? "bg-sabz" : "bg-lapis"}`} />
                
                <div className="relative z-10 flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className={`text-[12px] font-bold tracking-wider uppercase mb-1 ${isAllComplete ? "text-sabz" : "text-lapis"}`}>
                        {isAllComplete ? "All Milestones Achieved" : "Current Target"}
                      </span>
                      <h3 className="text-[28px] font-bold tracking-tight text-ink leading-none">
                        Level {activeLevel.cefrHint}
                      </h3>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[12px] text-ink-soft mb-0.5">Known Words</span>
                      <div className="flex items-baseline gap-1">
                        <span className="text-[22px] font-bold tracking-tight text-ink">{knownCount}</span>
                        <span className="text-[14px] text-ink-faint font-medium">/ {activeLevel.entryKnownWords}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Big Progress Bar */}
                  <div>
                    <div className="flex justify-between text-[13px] font-medium mb-2.5">
                      <span className={isAllComplete ? "text-sabz" : "text-ink-soft"}>Progress to milestone</span>
                      <span className={isAllComplete ? "text-sabz" : "text-lapis"}>{progress}%</span>
                    </div>
                    <div className={`h-3.5 w-full overflow-hidden rounded-full ${isAllComplete ? "bg-sabz/20" : "bg-line"}`}>
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ease-out ${
                          isAllComplete ? "bg-sabz" : "bg-lapis"
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}
      </section>

      {/* Dictionary Section */}
      <section>
        <div className="flex rounded-lg bg-surface p-1 shadow-sm border border-line mb-4">
          <button
            type="button"
            onClick={() => setFilter("learning")}
            className={`flex-1 rounded-md py-2 text-center text-[14px] font-medium transition-colors ${
              filter === "learning"
                ? "bg-lapis-soft text-lapis shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            Learning
          </button>
          <button
            type="button"
            onClick={() => setFilter("known")}
            className={`flex-1 rounded-md py-2 text-center text-[14px] font-medium transition-colors ${
              filter === "known"
                ? "bg-sabz-soft text-sabz shadow-sm"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            Known
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {filteredWords.length === 0 ? (
            <div className="py-8 text-center text-ink-faint text-[14px]">
              No {filter} words yet.
            </div>
          ) : (
            filteredWords.map((word) => {
              const lexeme = lexemeById(word.lexeme_id);
              if (!lexeme) return null;

              // Calculate how close the word is to being known
              let srsProgress = 100;
              if (word.status === "learning") {
                const stability = word.fsrs?.stability ?? 0;
                srsProgress = Math.min(100, Math.max(0, Math.round((stability / KNOWN_STABILITY_DAYS) * 100)));
              }

              return (
                <div
                  key={word.lexeme_id}
                  className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="flex flex-col gap-0.5 max-w-[60%]">
                    <p lang="prs" className="text-[20px] leading-snug text-left">
                      {lexeme.dari}
                    </p>
                    <p className="text-[12px] text-ink-soft">{lexeme.translit}</p>
                    <p className="mt-1 text-[14px] font-medium leading-tight truncate">
                      {lexeme.glossEn}
                    </p>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="text-[12px] font-medium text-ink-soft">
                      {srsProgress}%
                    </div>
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          word.status === "known" ? "bg-sabz" : "bg-lapis"
                        }`}
                        style={{ width: `${srsProgress}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-ink-faint uppercase tracking-wide">
                      {word.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
