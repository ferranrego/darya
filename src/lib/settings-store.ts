import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReadingFont = "vazirmatn" | "scheherazade" | "amiri" | "lateef";

interface SettingsState {
  readingFont: ReadingFont;
  setReadingFont: (font: ReadingFont) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      readingFont: "vazirmatn",
      setReadingFont: (font) => set({ readingFont: font }),
    }),
    {
      name: "darya-settings",
    }
  )
);
