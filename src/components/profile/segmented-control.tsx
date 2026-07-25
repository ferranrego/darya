"use client";

import { motion } from "motion/react";
import { useId } from "react";
import { hapticTap } from "@/lib/util/haptics";

export interface SegmentedControlOption<T> {
  value: T;
  label: string;
  detail?: string;
  dariPreview?: boolean;
}

interface SegmentedControlProps<T> {
  options: SegmentedControlOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  className = "",
}: SegmentedControlProps<T>) {
  const layoutId = useId();

  return (
    <div
      className={`relative flex w-full flex-wrap gap-1 rounded-2xl bg-surface/50 p-1 ring-1 ring-inset ring-line/50 backdrop-blur-md ${className}`}
    >
      {options.map((option) => {
        const isActive = value === option.value;

        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => {
              hapticTap();
              onChange(option.value);
            }}
            className="relative flex flex-1 flex-col items-center justify-center rounded-xl px-2 py-2.5 outline-none"
            style={{ minWidth: "80px", WebkitTapHighlightColor: "transparent" }}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 z-0 rounded-xl bg-surface shadow-sm ring-1 ring-line/30"
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
            <div className="relative z-10 flex flex-col items-center gap-1">
              <span
                className={`text-[14px] transition-colors duration-200 ${
                  isActive ? "font-semibold text-lapis" : "font-medium text-ink-soft hover:text-ink"
                }`}
              >
                {option.label}
              </span>
              {option.detail && (
                <span
                  className={`text-[11px] transition-colors duration-200 ${
                    isActive ? "text-lapis/70" : "text-ink-faint"
                  }`}
                >
                  {option.detail}
                </span>
              )}
              {option.dariPreview && (
                <span
                  className={`mt-1 text-[24px] transition-colors duration-200 ${
                    isActive ? "text-lapis" : "text-ink-soft"
                  } font-${String(option.value)}`}
                  lang="prs"
                  dir="rtl"
                >
                  زبان دری
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
