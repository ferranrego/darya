"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import { useProfile, useUserWords } from "@/lib/queries/hooks";
import { levels } from "@/lib/content/load";

export function MilestoneObserver() {
  const { data: profile } = useProfile();
  const { data: words } = useUserWords();

  const prevKnownCount = useRef<number | null>(null);
  const prevLevelIdx = useRef<number | null>(null);
  const prevStreak = useRef<number | null>(null);

  useEffect(() => {
    if (!words || !profile) return;

    const knownCount = words.filter((w) => w.status === "known").length;
    const currentLevelIdx = levels.findIndex((l) => l.id === profile.level_estimate);
    const streak = profile.streak_current;

    let shouldCelebrate = false;

    // Check Known Words Milestones (every 100 words)
    if (prevKnownCount.current !== null && knownCount > prevKnownCount.current) {
      if (Math.floor(knownCount / 100) > Math.floor(prevKnownCount.current / 100)) {
        shouldCelebrate = true;
      }
    }

    // Check Level Milestones
    if (prevLevelIdx.current !== null && currentLevelIdx > prevLevelIdx.current) {
      shouldCelebrate = true;
    }

    // Check Streak Milestones (7, 30, 100, 365, etc)
    if (prevStreak.current !== null && streak > prevStreak.current) {
      const milestones = [7, 30, 50, 100, 365];
      if (milestones.includes(streak)) {
        shouldCelebrate = true;
      }
    }

    if (shouldCelebrate) {
      triggerConfetti();
    }

    // Update refs for next render
    prevKnownCount.current = knownCount;
    prevLevelIdx.current = currentLevelIdx;
    prevStreak.current = streak;
  }, [words, profile]);

  return null;
}

function triggerConfetti() {
  const duration = 3 * 1000;
  const animationEnd = Date.now() + duration;
  const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 100 };

  const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

  const interval: ReturnType<typeof setInterval> = setInterval(function() {
    const timeLeft = animationEnd - Date.now();

    if (timeLeft <= 0) {
      return clearInterval(interval);
    }

    const particleCount = 50 * (timeLeft / duration);
    
    // Confetti from two sides
    confetti(Object.assign({}, defaults, { 
      particleCount,
      origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
      colors: ['#2856c2', '#ffbc0b', '#189a61', '#ffffff'] // Lapis, Saffron, Sabz
    }));
    confetti(Object.assign({}, defaults, { 
      particleCount,
      origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
      colors: ['#2856c2', '#ffbc0b', '#189a61', '#ffffff']
    }));
  }, 250);
}
