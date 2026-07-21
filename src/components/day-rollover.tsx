"use client";

import { useDayRollover } from "@/lib/use-day-rollover";

/** Invisible: refreshes day-scoped queries when Barcelona midnight passes. */
export function DayRollover() {
  useDayRollover();
  return null;
}
