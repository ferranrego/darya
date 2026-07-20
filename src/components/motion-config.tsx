"use client";

import { MotionGlobalConfig } from "motion/react";
import { useEffect } from "react";

/**
 * Testing escape hatch: `?instant=1` (persisted for the session) completes all
 * motion animations immediately. Used by automated E2E runs in throttled
 * browsers; real users never hit this path.
 */
export function MotionSetup() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("instant") === "1") {
      sessionStorage.setItem("darya-instant", "1");
    }
    if (sessionStorage.getItem("darya-instant") === "1") {
      MotionGlobalConfig.skipAnimations = true;
    }
  }, []);
  return null;
}
