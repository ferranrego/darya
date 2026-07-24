"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useActivityHistory } from "@/lib/queries/hooks";
import { localDate } from "@/lib/db/activity";

const WEEKDAY = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * Momentum: a 7-day XP sparkline plus the known/learning word counts with a
 * milestone nudge. Surfaces the daily_activity history the home never showed,
 * giving the screen a sense of history and forward pull.
 */
export function MomentumStrip({
  knownCount,
  learningCount,
}: {
  knownCount: number;
  learningCount: number;
}) {
  const { data: history } = useActivityHistory();

  const days = useMemo(() => {
    const byDate = new Map((history ?? []).map((r) => [r.date, r.xp]));
    return Array.from({ length: 7 }, (_, i) => {
      // eslint-disable-next-line react-hooks/purity
      const d = new Date(Date.now() - (6 - i) * 86_400_000);
      const key = localDate(d);
      return { key, xp: byDate.get(key) ?? 0, dow: new Date(key + "T00:00:00Z").getUTCDay() };
    });
  }, [history]);

  const weekTotal = days.reduce((s, d) => s + d.xp, 0);
  const maxXp = Math.max(1, ...days.map((d) => d.xp));
  const todayKey = localDate();

  // Nudge when within 20 of the next 100-word milestone.
  const toNextHundred = knownCount > 0 ? 100 - (knownCount % 100 || 100) : 0;
  const nudge = knownCount > 0 && toNextHundred > 0 && toNextHundred <= 20
    ? `${toNextHundred} to ${Math.ceil((knownCount + 1) / 100) * 100} known`
    : null;

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="mb-3 flex items-baseline justify-between">
        <p className="text-[13px] font-medium text-ink-soft">This week</p>
        <p className="text-[12px] text-ink-faint">
          <span className="font-semibold text-ink">{weekTotal}</span> XP
        </p>
      </div>

      <div className="flex items-end justify-between gap-1.5" style={{ height: 56 }}>
        {days.map((d) => {
          const isToday = d.key === todayKey;
          const h = 8 + Math.round((d.xp / maxXp) * 40);
          return (
            <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
              <div className="flex w-full flex-1 items-end justify-center">
                <div
                  className={`w-full max-w-[26px] rounded-full transition-all duration-500 ease-out ${
                    isToday ? "bg-lapis" : d.xp > 0 ? "bg-lapis-soft" : "bg-line"
                  }`}
                  style={{ height: h }}
                />
              </div>
              <span className={`text-[10px] ${isToday ? "font-semibold text-lapis" : "text-ink-faint"}`}>
                {WEEKDAY[d.dow]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4">
        <Link href="/words?filter=known" className="group flex items-baseline gap-1.5">
          <span className="text-[22px] font-semibold tracking-tight text-sabz">{knownCount}</span>
          <span className="text-[13px] text-ink-soft">known</span>
        </Link>
        <Link href="/words?filter=learning" className="group flex items-baseline gap-1.5">
          <span className="text-[22px] font-semibold tracking-tight text-lapis">{learningCount}</span>
          <span className="text-[13px] text-ink-soft">learning</span>
        </Link>
      </div>
      {nudge && <p className="mt-2 text-[12px] text-ink-faint">{nudge} - keep going.</p>}
    </section>
  );
}
