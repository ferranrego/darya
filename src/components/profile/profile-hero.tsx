"use client";

import { motion } from "motion/react";
import { Sparkles, Flame, Trophy } from "lucide-react";

interface ProfileHeroProps {
  displayName: string;
  levelText: string;
  knownCount: number;
  xp: number;
  streakCurrent: number;
  streakBest: number;
}

export function ProfileHero({ 
  displayName, 
  levelText, 
  knownCount, 
  xp,
  streakCurrent,
  streakBest
}: ProfileHeroProps) {
  const firstName = displayName.split(" ")[0] || "Learner";
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex w-full flex-col pb-2 pt-4"
    >
      {/* Horizontal Identity Row */}
      <div className="flex w-full items-center gap-5 px-1">
        {/* Signature Monogram (Compact) */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          transition={{ delay: 0.1, duration: 0.5, type: "spring", bounce: 0.4 }}
          className="relative flex h-[76px] w-[76px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface shadow-[0_4px_14px_rgb(0,0,0,0.05)] ring-1 ring-inset ring-line/80"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <span className="text-[32px] font-bold text-ink">{initial}</span>
          
          <div className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-surface text-saffron shadow-sm ring-1 ring-inset ring-line/80">
            <Sparkles size={11} fill="currentColor" className="text-saffron" />
          </div>
        </motion.div>

        {/* Name & Level */}
        <div className="flex flex-col items-start gap-1.5">
          <motion.h1
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="text-[24px] font-bold tracking-tight text-ink leading-none"
          >
            {displayName}
          </motion.h1>
          
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25, duration: 0.5 }}
            className="inline-flex items-center rounded-full bg-lapis/5 px-2.5 py-0.5 ring-1 ring-inset ring-lapis/10"
          >
            <span className="text-[10px] font-medium uppercase tracking-widest text-lapis-deep">
              {levelText}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Unified Metrics Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.5 }}
        className="mt-6 flex w-full items-center justify-between rounded-2xl bg-surface/60 px-5 py-3.5 shadow-sm ring-1 ring-inset ring-line/60 backdrop-blur-md"
      >
        <div className="flex flex-1 flex-col items-center">
          <span className="text-[18px] font-bold leading-none text-ink tracking-tight">{knownCount}</span>
          <span className="mt-1 text-[9px] font-medium uppercase tracking-widest text-ink-soft">
            Words
          </span>
        </div>
        
        <div className="h-8 w-px bg-line/60" />
        
        <div className="flex flex-1 flex-col items-center">
          <span className="text-[18px] font-bold leading-none text-ink tracking-tight">{xp}</span>
          <span className="mt-1 text-[9px] font-medium uppercase tracking-widest text-ink-soft">
            XP
          </span>
        </div>

        <div className="h-8 w-px bg-line/60" />

        <div className="flex flex-1 flex-col items-center">
          <div className="flex items-center gap-1">
            <Flame size={12} className="text-saffron" />
            <span className="text-[18px] font-bold leading-none text-ink tracking-tight">{streakCurrent}</span>
          </div>
          <span className="mt-1 text-[9px] font-medium uppercase tracking-widest text-ink-soft">
            Day
          </span>
        </div>

        <div className="h-8 w-px bg-line/60" />

        <div className="flex flex-1 flex-col items-center">
          <div className="flex items-center gap-1">
            <Trophy size={12} className="text-lapis" />
            <span className="text-[18px] font-bold leading-none text-ink tracking-tight">{streakBest}</span>
          </div>
          <span className="mt-1 text-[9px] font-medium uppercase tracking-widest text-ink-soft">
            Best
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}
