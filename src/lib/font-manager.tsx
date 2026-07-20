"use client";

import { useEffect } from "react";
import { useSettingsStore } from "./settings-store";

export function FontManager() {
  const readingFont = useSettingsStore((state) => state.readingFont);

  useEffect(() => {
    if (readingFont === "scheherazade") {
      document.documentElement.classList.add("use-scheherazade");
    } else {
      document.documentElement.classList.remove("use-scheherazade");
    }
  }, [readingFont]);

  return null;
}
