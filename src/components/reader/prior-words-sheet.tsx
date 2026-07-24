"use client";

import { AnimatePresence, motion } from "motion/react";
import { Poncha } from "@/components/poncha";
import { Button } from "@/components/ui/button";
import { levelLabel } from "@/lib/content/load";

/**
 * One-time choice offered before the learner's second text: bulk-mark the
 * words from levels below their assessed level as known, or leave them
 * untracked and mark words manually while reading.
 */
export function PriorWordsSheet({
  open,
  wordCount,
  levelId,
  busy,
  onSeed,
  onManual,
  onClose,
}: {
  open: boolean;
  wordCount: number;
  levelId: string | undefined;
  busy: boolean;
  onSeed: () => void;
  onManual: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="prior-words-scrim"
            className="fixed inset-0 z-40 bg-ink/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={busy ? undefined : onClose}
          />
          <motion.div
            key="prior-words-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Words from earlier levels"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-b-0 border-line bg-surface px-6 pt-6 shadow-[0_-8px_40px_rgba(31,26,23,0.12)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="flex justify-center">
              <Poncha pose="read" size={110} />
            </div>
            <h2 className="mt-4 text-center text-[20px] font-semibold tracking-tight">
              Mark earlier words as known?
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center text-[14.5px] leading-relaxed text-ink-soft">
              You tested at {levelLabel(levelId)}, so the {wordCount.toLocaleString()} most
              common words from the levels below are probably familiar. Mark them all as
              known now, or keep them unmarked and tap words yourself as you read.
            </p>
            <div className="mx-auto mt-6 flex max-w-sm flex-col gap-3">
              <Button size="lg" disabled={busy} onClick={onSeed}>
                {busy ? "Marking…" : `Mark ${wordCount.toLocaleString()} words known`}
              </Button>
              <Button size="lg" variant="secondary" disabled={busy} onClick={onManual}>
                I&apos;ll mark them myself
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
