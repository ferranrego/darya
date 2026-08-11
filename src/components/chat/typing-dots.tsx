"use client";

import { motion, useReducedMotion } from "motion/react";
import { profile as lang } from "@/lib/lang";

/**
 * Three dots that say a reply is being written.
 *
 * The wait here is a second or two of nothing, which reads as a dropped
 * message rather than as work in progress - so this is not decoration, it is
 * the only feedback between hitting send and the bubble arriving.
 *
 * Announced once as a sentence rather than as three animating dots: a screen
 * reader gets "Poncha is thinking", and so does anyone who has asked the system
 * for reduced motion.
 */
export function TypingDots({ label }: { label?: string }) {
  const reduced = useReducedMotion();
  const text = label ?? `${lang.brand.mascotName} is thinking…`;

  return (
    <div className="flex items-center gap-1.5" role="status" aria-live="polite">
      <span className="sr-only">{text}</span>

      {reduced ? (
        <span aria-hidden className="text-[14px] italic text-ink-soft">
          {text}
        </span>
      ) : (
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            aria-hidden
            className="block h-1.5 w-1.5 rounded-full bg-ink-faint"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "easeInOut",
              // Staggered rather than synchronised, so it reads as a wave
              // travelling across the dots instead of a single blinking blob.
              delay: i * 0.16,
            }}
          />
        ))
      )}
    </div>
  );
}
