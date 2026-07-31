import type { PonchaPose } from "@/components/poncha";
import { profile as lang } from "@/lib/lang";

/**
 * Time-of-day phases that drive the Home hero's mood: the greeting, Poncha's
 * resting pose, and the tonal wash behind the "Today" card. Based on the user's
 * *device-local* hour (not APP_TIMEZONE) - the greeting should match the light
 * outside the user's window, whereas streak/goal rollover stays on Barcelona
 * time (see lib/db/activity.ts).
 */
export type DayPhase = "morning" | "day" | "evening" | "night";

export interface TimeOfDay {
  phase: DayPhase;
  /** Transliterated Dari greeting, kept in Latin to sit cleanly beside a name. */
  greeting: string;
  /** Poncha's default resting pose for this phase (progress can override it). */
  restPose: PonchaPose;
  isNight: boolean;
}

export function phaseForHour(hour: number): DayPhase {
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "day";
  if (hour >= 17 && hour < 22) return "evening";
  return "night";
}



const REST_POSE: Record<DayPhase, PonchaPose> = {
  morning: "home",
  day: "home",
  evening: "home",
  night: "sleep",
};

export function timeOfDay(now = new Date()): TimeOfDay {
  const phase = phaseForHour(now.getHours());
  return {
    phase,
    greeting: lang.samples.phaseGreetings[phase],
    restPose: REST_POSE[phase],
    isNight: phase === "night",
  };
}
