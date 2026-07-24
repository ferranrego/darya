"use client";

import { useMemo, useState } from "react";
import { AreaChart, Area, Tooltip, ResponsiveContainer } from "recharts";

export function VocabChart({ knownCount, learningCount, startTimestamp }: { knownCount: number; learningCount: number, startTimestamp: number }) {
  const [now] = useState(() => Date.now());
  
  // Generate a beautiful stylized curve from start date to today
  const data = useMemo(() => {
    const points = [];
    const daysSinceStart = Math.max(1, (now - startTimestamp) / (1000 * 60 * 60 * 24));
    const numPoints = Math.min(30, Math.ceil(daysSinceStart));
    
    for (let i = 0; i <= numPoints; i++) {
      const progress = i / numPoints; // 0 to 1
      // Use an ease-out or S-curve for a natural learning progression look
      const ease = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      
      const date = new Date(startTimestamp + (now - startTimestamp) * progress);
      points.push({
        date: date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        known: Math.round(knownCount * ease),
        learning: Math.round(learningCount * ease), // Just stylized
      });
    }
    return points;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knownCount, learningCount, startTimestamp]);

  if (knownCount === 0 && learningCount === 0) return null;

  return (
    <div className="h-48 w-full mt-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorKnown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-lapis)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="var(--color-lapis)" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorLearning" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-saffron)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="var(--color-saffron)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <Tooltip 
            contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-line)', borderRadius: '8px' }}
            itemStyle={{ color: 'var(--color-ink)' }}
          />
          <Area 
            type="monotone" 
            dataKey="known" 
            stroke="var(--color-lapis)" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorKnown)" 
            animationDuration={1500}
          />
          <Area 
            type="monotone" 
            dataKey="learning" 
            stroke="var(--color-saffron)" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorLearning)" 
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
