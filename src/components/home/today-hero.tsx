"use client";

import NumberFlow from "@number-flow/react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Poncha, type PonchaPose } from "@/components/poncha";
import { ProgressRing } from "@/components/ui/progress-ring";
import type { DayPhase } from "@/lib/util/time-of-day";

export interface HeroCta {
  href: string;
  label: string;
  /** Small qualifier under the label, e.g. "A2 · 3 of 9 lessons". */
  hint?: string;
}

/** Per-phase tonal wash + surface treatment. Night is the one dark surface. */
function surfaceFor(phase: DayPhase): { dark: boolean; layer: string; base: string } {
  switch (phase) {
    case "morning":
      return {
        dark: false,
        base: "var(--surface)",
        layer:
          "radial-gradient(120% 85% at 12% 0%, rgba(217,160,54,0.16), transparent 60%), radial-gradient(95% 75% at 100% 100%, rgba(43,76,140,0.08), transparent 62%)",
      };
    case "day":
      return {
        dark: false,
        base: "var(--surface)",
        layer:
          "radial-gradient(120% 90% at 88% 0%, rgba(43,76,140,0.11), transparent 60%), radial-gradient(90% 75% at 0% 100%, rgba(62,124,89,0.07), transparent 62%)",
      };
    case "evening":
      return {
        dark: false,
        base: "var(--surface)",
        layer:
          "radial-gradient(125% 90% at 12% 0%, rgba(217,160,54,0.20), transparent 62%), radial-gradient(100% 90% at 100% 100%, rgba(43,76,140,0.13), transparent 64%)",
      };
    case "night":
      return {
        dark: true,
        base: "linear-gradient(160deg, #223a67 0%, #1a2e56 55%, #142343 100%)",
        layer:
          "radial-gradient(90% 70% at 82% -5%, rgba(240,244,251,0.14), transparent 60%), radial-gradient(70% 60% at 8% 108%, rgba(217,160,54,0.12), transparent 62%)",
      };
  }
}

/** XP numeral that counts up from zero once on mount (NumberFlow). */
function RingXp({ xp, goal, dark }: { xp: number; goal: number; dark: boolean }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? xp : 0);
  useEffect(() => {
    if (reduce) {
      const t2 = setTimeout(() => setShown(xp), 0);
      return () => clearTimeout(t2);
    }
    const t = setTimeout(() => setShown(xp), 260);
    return () => clearTimeout(t);
  }, [xp, reduce]);

  return (
    <div className="text-center">
      <p
        className={`text-[34px] font-semibold leading-none tracking-tight tabular-nums ${
          dark ? "text-white" : "text-ink"
        }`}
      >
        <NumberFlow value={shown} />
      </p>
      <p className={`mt-1 text-[12px] ${dark ? "text-white/55" : "text-ink-faint"}`}>of {goal} XP</p>
    </div>
  );
}

export function TodayHero({
  phase,
  pose,
  todayXp,
  dailyGoal,
  streakCurrent,
  cta,
}: {
  phase: DayPhase;
  pose: PonchaPose;
  todayXp: number;
  dailyGoal: number;
  streakCurrent: number;
  cta: HeroCta;
}) {
  const reduce = useReducedMotion();
  const surface = surfaceFor(phase);
  const dark = surface.dark;
  const goalMet = dailyGoal > 0 && todayXp >= dailyGoal;
  const remaining = Math.max(dailyGoal - todayXp, 0);

  const status = goalMet
    ? phase === "night"
      ? "Daily goal complete - rest well"
      : "Daily goal complete - nice work"
    : todayXp > 0
      ? `${remaining} XP to today's goal`
      : streakCurrent > 0
        ? `Keep your ${streakCurrent}-day streak alive`
        : "Your first XP is one tap away";

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className={`relative overflow-hidden rounded-[28px] border p-5 ${
        dark
          ? "border-white/10 shadow-[0_20px_50px_-18px_rgba(20,35,67,0.65)]"
          : "border-line shadow-[0_18px_44px_-24px_rgba(31,26,23,0.28)]"
      }`}
      style={{ background: surface.base }}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: surface.layer }} />

      <div className="relative flex items-center justify-between gap-2">
        <ProgressRing
          value={todayXp}
          max={dailyGoal}
          size={128}
          stroke={11}
          trackColor={dark ? "rgba(255,255,255,0.14)" : "var(--line)"}
          progressColor={goalMet ? "var(--saffron)" : dark ? "#8fb0e8" : "var(--lapis)"}
        >
          <RingXp xp={todayXp} goal={dailyGoal} dark={dark} />
        </ProgressRing>

        <motion.div
          animate={reduce ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          className="shrink-0"
        >
          <Poncha pose={pose} size={122} priority />
        </motion.div>
      </div>

      <p className={`relative mt-4 text-[14px] ${dark ? "text-white/75" : "text-ink-soft"}`}>{status}</p>

      <Link
        href={cta.href}
        className={`relative mt-3 flex h-13 items-center justify-between gap-3 rounded-full px-5 transition-all duration-200 active:scale-[0.98] ${
          dark
            ? "bg-white text-lapis-deep hover:bg-white/90"
            : "bg-lapis text-white hover:bg-lapis-deep shadow-[0_8px_20px_-8px_rgba(30,53,99,0.55)]"
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate text-[16px] font-semibold leading-tight">{cta.label}</span>
          {cta.hint && (
            <span className={`block truncate text-[12px] leading-tight ${dark ? "text-lapis" : "text-white/70"}`}>
              {cta.hint}
            </span>
          )}
        </span>
        <ArrowRight size={20} className="shrink-0" />
      </Link>
    </motion.section>
  );
}
