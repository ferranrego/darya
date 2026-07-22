"use client";

import { useEffect } from "react";
import { useSettingsStore } from "./settings-store";

export function FontManager() {
  const readingFont = useSettingsStore((state) => state.readingFont);

  useEffect(() => {
    document.documentElement.classList.remove("use-scheherazade", "use-amiri", "use-lateef");
    if (readingFont !== "vazirmatn") {
      document.documentElement.classList.add(`use-${readingFont}`);
    }
  }, [readingFont]);

  return null;
}
