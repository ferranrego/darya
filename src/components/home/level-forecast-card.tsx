"use client";

import NumberFlow from "@number-flow/react";
import { useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import type { LevelForecast } from "@/lib/util/level-forecast";

/**
 * "You're on pace for A2 in ~34 days." Turns the known-word forecast into a
 * tangible, motivating countdown toward the next CEFR level.
 */
export function LevelForecastCard({ forecast }: { forecast: LevelForecast }) {
  const reduce = useReducedMotion();
  const [days, setDays] = useState(reduce ? (forecast.daysToGo ?? 0) : 0);

  useEffect(() => {
    if (forecast.daysToGo == null) return;
    if (reduce) {
      setDays(forecast.daysToGo);
      return;
    }
    const t = setTimeout(() => setDays(forecast.daysToGo!), 260);
    return () => clearTimeout(t);
  }, [forecast.daysToGo, reduce]);

  const headline = () => {
    switch (forecast.status) {
      case "forecast":
        return (
          <span className="tabular-nums">
            <NumberFlow value={days} className="text-lapis" /> {forecast.daysToGo === 1 ? "day" : "days"}
            <span className="text-ink-soft"> to {forecast.nextCefr}</span>
          </span>
        );
      case "ready":
        return <span>Ready for {forecast.nextCefr}</span>;
      case "need-data":
        return (
          <span>
            <span className="text-lapis">{forecast.wordsToGo}</span> words to {forecast.nextCefr}
          </span>
        );
      case "max":
        return <span>Top level reached</span>;
    }
  };

  const caption =
    forecast.status === "forecast"
      ? `${forecast.wordsToGo} words to go at your current pace`
      : forecast.status === "need-data"
        ? "Learn a few more words to forecast your pace"
        : forecast.status === "ready"
          ? "You've hit the word target - level up soon"
          : "You're at the highest level Darya tracks";

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[13px] font-medium text-ink-soft">
            <TrendingUp size={14} className="text-lapis" />
            Next level
          </div>
          <p className="mt-1 text-[19px] font-semibold tracking-tight">{headline()}</p>
        </div>
        {forecast.nextCefr && (
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5 text-[12px] font-semibold">
            <span className="rounded-md bg-paper px-1.5 py-0.5 text-ink-faint">{forecast.currentCefr}</span>
            <span className="text-ink-faint">→</span>
            <span className="rounded-md bg-lapis-soft px-1.5 py-0.5 text-lapis">{forecast.nextCefr}</span>
          </div>
        )}
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-lapis transition-[width] duration-700 ease-out"
          style={{ width: `${Math.round(forecast.progress * 100)}%` }}
        />
      </div>
      <p className="mt-2 text-[12px] text-ink-faint">{caption}</p>
    </section>
  );
}
