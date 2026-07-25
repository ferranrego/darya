"use client";

import { motion } from "motion/react";
import { hapticTap } from "@/lib/util/haptics";
import type { ReadingFont } from "@/lib/settings-store";

export interface FontCarouselOption {
  value: ReadingFont;
  label: string;
  desc: string;
}

interface FontCarouselProps {
  options: FontCarouselOption[];
  value: ReadingFont;
  onChange: (value: ReadingFont) => void;
  className?: string;
}

export function FontCarousel({
  options,
  value,
  onChange,
  className = "",
}: FontCarouselProps) {
  return (
    <div className={`relative -mx-4 px-4 ${className}`}>
      {/* Scroll Container */}
      <div className="flex snap-x snap-mandatory overflow-x-auto pb-4 pt-2 hide-scrollbar">
        <div className="flex gap-4 px-2">
          {options.map((option) => {
            const isActive = value === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  if (!isActive) {
                    hapticTap();
                    onChange(option.value);
                  }
                }}
                className={`relative flex h-[160px] w-[130px] shrink-0 snap-center flex-col items-center justify-between rounded-3xl p-4 outline-none transition-all duration-300 ${
                  isActive
                    ? "bg-surface shadow-[0_8px_30px_rgb(0,0,0,0.08)] ring-2 ring-saffron"
                    : "bg-surface/50 opacity-70 shadow-sm ring-1 ring-inset ring-line/50 hover:bg-surface/80 hover:opacity-100"
                }`}
                style={{ WebkitTapHighlightColor: "transparent" }}
              >
                {/* Active Indicator Dot */}
                <div
                  className={`absolute right-3 top-3 h-2.5 w-2.5 rounded-full transition-colors duration-300 ${
                    isActive ? "bg-saffron" : "bg-transparent"
                  }`}
                />

                {/* Font Showcase */}
                <div className="flex flex-1 items-center justify-center pt-2">
                  <motion.span
                    animate={{ scale: isActive ? 1.1 : 1 }}
                    transition={{ type: "spring", bounce: 0.4, duration: 0.6 }}
                    className={`text-[52px] leading-none transition-colors duration-300 ${
                      isActive ? "text-ink" : "text-ink-soft"
                    } font-${option.value}`}
                    lang="prs"
                    dir="rtl"
                  >
                    دری
                  </motion.span>
                </div>

                {/* Font Info */}
                <div className="flex flex-col items-center gap-0.5 pb-1">
                  <span
                    className={`text-[14px] transition-colors duration-300 ${
                      isActive ? "font-semibold text-ink" : "font-medium text-ink-soft"
                    }`}
                  >
                    {option.label}
                  </span>
                  <span
                    className={`text-[11px] transition-colors duration-300 ${
                      isActive ? "text-saffron-dark" : "text-ink-faint"
                    }`}
                  >
                    {option.desc}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Edge Fades for visual polish */}
      <div className="pointer-events-none absolute bottom-4 left-0 top-2 w-6 bg-gradient-to-r from-[#f4f7f5] to-transparent" />
      <div className="pointer-events-none absolute bottom-4 right-0 top-2 w-6 bg-gradient-to-l from-[#f4f7f5] to-transparent" />
    </div>
  );
}
