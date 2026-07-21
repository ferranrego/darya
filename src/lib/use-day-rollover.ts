"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { APP_TIMEZONE, localDate } from "./db/activity";

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  timeZoneName: "longOffset",
});

/** Barcelona's current UTC offset as "+01:00" / "+02:00". */
function barcelonaOffset(d: Date): string {
  const name = offsetFormatter
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  // "GMT+02:00" → "+02:00"; plain "GMT" would mean +00:00 (never Madrid, but be safe).
  return name?.match(/[+-]\d{2}:\d{2}/)?.[0] ?? "+00:00";
}

/**
 * Milliseconds until the next Barcelona midnight. On the one edge where this
 * is off by an hour (a timer armed between 00:00 and the DST switch on a
 * transition day), the caller's date-changed guard re-arms harmlessly.
 */
export function msUntilNextBarcelonaMidnight(now = new Date()): number {
  const noon = new Date(`${localDate(now)}T12:00:00Z`);
  noon.setUTCDate(noon.getUTCDate() + 1);
  const tomorrow = localDate(noon); // UTC noon is mid-day in Barcelona: date-safe
  const midnight = new Date(`${tomorrow}T00:00:00${barcelonaOffset(now)}`);
  return Math.max(midnight.getTime() - now.getTime(), 0);
}

/**
 * Keep day-scoped queries honest across the Barcelona midnight boundary:
 * a timer covers "app left open overnight" and a visibilitychange listener
 * covers "PWA resumed the next day" (refetchOnWindowFocus is off app-wide).
 */
export function useDayRollover() {
  const qc = useQueryClient();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let lastSeen = localDate();

    const rolloverIfDayChanged = () => {
      const today = localDate();
      if (today === lastSeen) return;
      lastSeen = today;
      qc.invalidateQueries({ queryKey: ["activity"] });
      qc.invalidateQueries({ queryKey: ["profile"] });
    };

    const arm = () => {
      timer = setTimeout(() => {
        rolloverIfDayChanged();
        arm(); // next midnight; or shortly again if we fired early (DST edge)
      }, Math.max(msUntilNextBarcelonaMidnight(), 1000));
    };
    arm();

    const onVisibility = () => {
      if (document.visibilityState === "visible") rolloverIfDayChanged();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [qc]);
}
