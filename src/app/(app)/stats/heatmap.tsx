"use client";

import { useActivityHistory } from "@/lib/queries/hooks";
import { localDate } from "@/lib/db/activity";
import { useMemo } from "react";
import { ActivityCalendar } from "react-activity-calendar";

export function ActivityHeatmap() {
  const { data: history } = useActivityHistory();

  const data = useMemo(() => {
    const pastDays = 14 * 7; // 14 weeks (98 days)
    const today = new Date();
    // Start on a Sunday
    const startOffset = today.getDay(); 
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (pastDays - 1 + startOffset));

    const historyMap = new Map((history || []).map(h => [h.date, h.xp + h.texts_read * 10 + h.reviews_done]));
    let maxActivity = 1;
    
    // Find max to scale levels
    for (const activity of historyMap.values()) {
      if (activity > maxActivity) maxActivity = activity;
    }

    const cells = [];
    for (let i = 0; i < pastDays + startOffset; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const dateStr = localDate(d);
      
      const isFuture = d > today;
      if (isFuture) continue;

      const activity = historyMap.get(dateStr) || 0;
      
      // Calculate level 0-4
      let level = 0;
      if (activity > 0) {
        level = Math.max(1, Math.ceil((activity / maxActivity) * 4));
      }

      cells.push({
        date: dateStr,
        count: activity,
        level: level as 0 | 1 | 2 | 3 | 4,
      });
    }

    return cells;
  }, [history]);

  return (
    <div className="mt-6 flex flex-col gap-2">
      <h3 className="text-[14px] font-medium text-ink-soft mb-1">Reading Habits Heatmap</h3>
      <div className="overflow-x-auto pb-2 scrollbar-none w-full" style={{ scrollSnapType: 'x mandatory' }}>
        <div className="min-w-max pr-1">
          <ActivityCalendar
            data={data}
            theme={{
              light: ['var(--color-line)', '#98b1e9', '#6388d7', '#4571cd', 'var(--color-lapis)'],
            }}
            blockSize={12}
            blockMargin={4}
            blockRadius={2}
          />
        </div>
      </div>
    </div>
  );
}
