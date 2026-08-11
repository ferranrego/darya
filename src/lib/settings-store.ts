import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReadingFont = "vazirmatn" | "scheherazade" | "amiri" | "lateef";

/** Which half of the Chat tab is open: the community room, or the AI partner. */
export type ChatMode = "room" | "tutor";

interface SettingsState {
  readingFont: ReadingFont;
  setReadingFont: (font: ReadingFont) => void;
  /**
   * Persisted so the tab reopens where it was left. It lives here rather than
   * in a `useEffect` reading localStorage because that reads as a setState in
   * an effect (a cascading render, and a lint error) *and* hydration-mismatches
   * the segmented control - zustand's persist rehydrates after mount and moves
   * the pill instead.
   */
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      readingFont: "vazirmatn",
      setReadingFont: (font) => set({ readingFont: font }),
      chatMode: "room",
      setChatMode: (mode) => set({ chatMode: mode }),
    }),
    {
      name: "darya-settings",
    }
  )
);
