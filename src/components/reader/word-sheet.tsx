"use client";

import { AnimatePresence, motion } from "motion/react";
import type { LexiconEntry } from "@/lib/content/schema";
import type { WordStatus } from "@/lib/db/types";

const statusLabel: Record<WordStatus | "new", { text: string; cls: string }> = {
  new: { text: "New word", cls: "bg-new-tint text-ink-soft" },
  learning: { text: "Learning", cls: "bg-lapis-soft text-lapis" },
  known: { text: "Known", cls: "bg-sabz-soft text-sabz" },
};

/**
 * Bottom sheet showing a tapped word's meaning. Opening it on a new word is
 * what moves the word into "learning" (handled by the parent).
 */
export function WordSheet({
  entry,
  surface,
  status,
  onClose,
}: {
  entry: LexiconEntry | null;
  surface: string | null;
  status: WordStatus | "new";
  onClose: () => void;
}) {
  const open = surface !== null;
  const badge = statusLabel[status];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-40 bg-ink/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-2xl rounded-t-3xl border border-b-0 border-line bg-surface px-6 pb-10 pt-3 shadow-[0_-8px_40px_rgba(31,26,23,0.12)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
          >
            <div className="mx-auto mb-4 h-1 w-9 rounded-full bg-line" />
            {entry ? (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p lang="prs" className="text-[36px] leading-snug">
                      {entry.dari}
                    </p>
                    <p className="mt-0.5 text-[15px] text-ink-soft">{entry.translit}</p>
                  </div>
                  <span className={`mt-1 shrink-0 rounded-full px-3 py-1 text-[12px] font-medium ${badge.cls}`}>
                    {badge.text}
                  </span>
                </div>
                <p className="mt-3 text-[18px] font-medium">{entry.glossEn}</p>
                <p className="text-[13px] text-ink-faint">{entry.pos}</p>
                <div className="mt-5 rounded-2xl bg-paper p-4">
                  <p lang="prs" className="text-[20px] leading-loose">
                    {entry.exampleDari}
                  </p>
                  <p className="mt-1 text-[13px] text-ink-soft">{entry.exampleTranslit}</p>
                  <p className="mt-0.5 text-[13px] text-ink-faint">{entry.exampleEn}</p>
                </div>
              </div>
            ) : (
              <div>
                <p lang="prs" className="text-[36px] leading-snug">
                  {surface}
                </p>
                <p className="mt-3 text-[15px] text-ink-soft">
                  Probably a name — it isn&apos;t in the dictionary yet.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
