"use client";

import { motion } from "motion/react";
import React, { useId } from "react";
import { hapticTap } from "@/lib/util/haptics";

export interface SleekSelectorOption<T> {
  value: T;
  label: string;
  detail?: React.ReactNode;
  danger?: boolean;
}

interface SleekSelectorProps<T> {
  options: SleekSelectorOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SleekSelector<T extends string | number>({
  options,
  value,
  onChange,
  className = "",
}: SleekSelectorProps<T>) {
  const layoutId = useId();
  
  // Find active option to display detail text below the control
  const activeOption = options.find((opt) => opt.value === value);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div
        className="relative flex w-full rounded-[20px] bg-surface/60 p-1.5 shadow-sm ring-1 ring-inset ring-line/50 backdrop-blur-xl"
      >
        {options.map((option) => {
          const isActive = value === option.value;

          return (
            <button
              key={String(option.value)}
              type="button"
              onClick={() => {
                if (!isActive) {
                  hapticTap();
                  onChange(option.value);
                }
              }}
              className="relative z-10 flex flex-1 items-center justify-center rounded-[14px] px-2 py-2 outline-none"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isActive && (
                <motion.div
                  layoutId={layoutId}
                  className={`absolute inset-0 z-0 rounded-[14px] shadow-[0_1px_3px_rgba(0,0,0,0.1)] ring-1 ${
                    option.danger 
                      ? "bg-danger/10 ring-danger/20" 
                      : "bg-white ring-black/[0.04]"
                  }`}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
              <span
                className={`relative z-10 text-[14px] transition-colors duration-200 ${
                  isActive 
                    ? option.danger ? "font-semibold text-danger" : "font-semibold text-ink" 
                    : "font-medium text-ink-soft hover:text-ink/80"
                }`}
              >
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
      
      {/* Dynamic Detail Text Container */}
      <div className="h-5 px-2">
        {activeOption?.detail && (
          <motion.p
            key={String(activeOption.value)}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.2 }}
            className="text-[13px] text-ink-soft"
          >
            {activeOption.detail}
          </motion.p>
        )}
      </div>
    </div>
  );
}
