"use client";

import { Check, ChevronDown, Lock } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Poncha } from "@/components/poncha";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  GRAMMAR_LEVEL_ORDER,
  grammarCourses,
  grammarLessonLevel,
  grammarLessons,
  grammarStartLevel,
} from "@/lib/content/load";
import type { GrammarLevel } from "@/lib/content/schema";
import { useGrammarProgress, useProfile } from "@/lib/queries/hooks";

const LEVEL_TITLE: Record<GrammarLevel, string> = {
  A1: "First sentences",
  A2: "Building on the basics",
  B1: "Expressing yourself",
  B2: "Nuance & fluency",
  C1: "Sophistication",
  C2: "Mastery",
};

/** Global 1-based lesson number in course order — stable, so compute it once. */
const LESSON_NUMBER = new Map(grammarLessons.map((l, i) => [l.id, i + 1]));

export default function GrammarMapPage() {
  const { data: progress } = useGrammarProgress();
  const { data: profile } = useProfile();
  const completedRows = useMemo(
    () => new Set(progress?.filter((p) => p.completed_at).map((p) => p.lesson_id)),
    [progress],
  );

  const startLevel = grammarStartLevel(profile?.level_estimate);
  const startIdx = GRAMMAR_LEVEL_ORDER.indexOf(startLevel);

  // A lesson counts as done if the learner finished it, OR its level is below
  // the level they tested into (those levels are skipped, not shown as work).
  const isLevelBelowStart = (level: GrammarLevel) => GRAMMAR_LEVEL_ORDER.indexOf(level) < startIdx;
  const isDone = (lessonId: string, level: GrammarLevel) =>
    completedRows.has(lessonId) || isLevelBelowStart(level);

  // Global linear unlock over the flattened lesson list.
  const availability = useMemo(() => {
    const map = new Map<string, boolean>();
    let unlocked = true;
    for (const course of grammarCourses) {
      for (const block of course.blocks) {
        for (const lesson of block.lessons) {
          map.set(lesson.id, unlocked);
          if (!isDone(lesson.id, course.level)) unlocked = false;
        }
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedRows, startIdx]);

  // Levels the learner tested past start collapsed; expandable to review.
  const [expanded, setExpanded] = useState<Set<GrammarLevel>>(new Set());
  const toggle = (level: GrammarLevel) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      return next;
    });

  const totalActive = grammarLessons.filter(
    (l) => !isLevelBelowStart(grammarLessonLevel(l.id) ?? "A1"),
  ).length;
  const doneActive = grammarLessons.filter(
    (l) => !isLevelBelowStart(grammarLessonLevel(l.id) ?? "A1") && completedRows.has(l.id),
  ).length;

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <h1 className="text-[26px] font-semibold tracking-tight">Grammar</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          {doneActive} of {totalActive} lessons · step by step, {startLevel} onward
        </p>
      </header>

      {doneActive === 0 && !expanded.size && (
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-5">
          <Poncha pose="read" size={92} />
          <p className="text-[15px] leading-relaxed text-ink-soft">
            Learn how Dari sentences work, one small step at a time. Each lesson teaches one idea,
            then lets you practise it.
          </p>
        </div>
      )}

      {grammarCourses.map((course) => {
        const level = course.level;
        const belowStart = isLevelBelowStart(level);
        const levelLessons = course.blocks.flatMap((b) => b.lessons);
        const doneInLevel = levelLessons.filter((l) => isDone(l.id, level)).length;
        const collapsed = belowStart && !expanded.has(level);

        return (
          <section key={level} className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => belowStart && toggle(level)}
              className={`flex items-center justify-between gap-3 pt-2 text-left ${
                belowStart ? "cursor-pointer" : "cursor-default"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span
                  className={`rounded-md px-2 py-0.5 text-[12px] font-bold ${
                    belowStart ? "bg-sabz-soft text-sabz" : "bg-lapis-soft text-lapis"
                  }`}
                >
                  {level}
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold tracking-tight">{LEVEL_TITLE[level]}</h2>
                  {belowStart && (
                    <p className="text-[12px] text-ink-faint">
                      Tested out · {collapsed ? "tap to review" : "tap to hide"}
                    </p>
                  )}
                </div>
              </div>
              {belowStart ? (
                <div className="flex items-center gap-2 text-sabz">
                  <Check size={18} strokeWidth={2.5} />
                  <ChevronDown
                    size={18}
                    className={`text-ink-faint transition-transform ${collapsed ? "" : "rotate-180"}`}
                  />
                </div>
              ) : (
                <ProgressRing value={doneInLevel} max={levelLessons.length} size={44} stroke={5}>
                  <span className="text-[11px] font-semibold tabular-nums text-ink-soft">
                    {doneInLevel}/{levelLessons.length}
                  </span>
                </ProgressRing>
              )}
            </button>

            {!collapsed && (
              <ol className="flex flex-col gap-3">
                {levelLessons.map((lesson) => {
                  const number = LESSON_NUMBER.get(lesson.id) ?? 0;
                  const done = completedRows.has(lesson.id) || belowStart;
                  const available = availability.get(lesson.id) ?? false;

                  const inner = (
                    <div
                      className={`flex items-center gap-4 rounded-2xl border p-4 transition-all duration-200 ${
                        done
                          ? "border-sabz/30 bg-sabz-soft/50"
                          : available
                            ? "border-line bg-surface hover:shadow-[0_4px_16px_rgba(31,26,23,0.06)]"
                            : "border-line/60 bg-paper opacity-55"
                      }`}
                    >
                      <div
                        className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-[18px] font-semibold ${
                          done
                            ? "bg-sabz text-white"
                            : available
                              ? "bg-lapis-soft text-lapis"
                              : "bg-line/50 text-ink-faint"
                        }`}
                      >
                        {done ? <Check size={22} strokeWidth={2.5} /> : number}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-medium">{lesson.title}</p>
                        <p className="truncate text-[13px] text-ink-soft">{lesson.subtitle}</p>
                      </div>
                      {!available && !done && <Lock size={16} className="shrink-0 text-ink-faint" />}
                    </div>
                  );

                  return (
                    <li key={lesson.id}>
                      {available || done ? (
                        <Link href={`/grammar/${lesson.id}`}>{inner}</Link>
                      ) : (
                        inner
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>
        );
      })}
    </div>
  );
}
