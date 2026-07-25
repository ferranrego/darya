"use client";

import { motion } from "motion/react";
import { Languages, Sparkles } from "lucide-react";
import { hapticTap } from "@/lib/util/haptics";

interface SentenceToolbarProps {
  showTranslit: boolean;
  onToggleTranslit: () => void;
  showTranslation: boolean;
  onToggleTranslation: () => void;
  onExplain: () => void;
}

export function SentenceToolbar({
  showTranslit,
  onToggleTranslit,
  showTranslation,
  onToggleTranslation,
  onExplain,
}: SentenceToolbarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -2 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-2 inline-flex items-center gap-0.5"
    >
      <button
        type="button"
        onClick={() => {
          hapticTap();
          onToggleTranslit();
        }}
        aria-pressed={showTranslit}
        aria-label="Toggle transliteration"
        className={`flex h-7 w-9 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
          showTranslit
            ? "bg-lapis-soft text-lapis"
            : "text-ink-faint hover:bg-surface hover:text-lapis"
        }`}
      >
        abc
      </button>
      <button
        type="button"
        onClick={() => {
          hapticTap();
          onToggleTranslation();
        }}
        aria-pressed={showTranslation}
        aria-label="Toggle translation"
        className={`flex h-7 w-9 items-center justify-center rounded-full transition-colors ${
          showTranslation
            ? "bg-lapis-soft text-lapis"
            : "text-ink-faint hover:bg-surface hover:text-lapis"
        }`}
      >
        <Languages size={14} />
      </button>
      <button
        type="button"
        onClick={() => {
          hapticTap();
          onExplain();
        }}
        aria-label="Explain this sentence"
        className="flex h-7 w-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-saffron-soft hover:text-saffron"
      >
        <Sparkles size={14} />
      </button>
    </motion.div>
  );
}
