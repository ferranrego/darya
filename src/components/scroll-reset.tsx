"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The app shell scrolls an inner container (#app-scroll), not the window, so
 * Next.js's built-in scroll reset on navigation never fires. This mirrors it:
 * jump back to the top whenever the route changes.
 */
export function ScrollReset() {
  const pathname = usePathname();
  useEffect(() => {
    document.getElementById("app-scroll")?.scrollTo({ top: 0 });
  }, [pathname]);
  return null;
}
