"use client";

import { motion } from "motion/react";
import { hapticTap } from "@/lib/util/haptics";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => {
        hapticTap();
        onChange(!checked);
      }}
      className={`relative flex h-7 w-12 cursor-pointer items-center rounded-full p-1 transition-colors duration-300 ${
        checked ? "bg-sabz" : "bg-line"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={`h-5 w-5 rounded-full bg-white shadow-sm ${
          checked ? "ml-auto" : "mr-auto"
        }`}
      />
    </button>
  );
}
