"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { LexiconEntry } from "@/lib/content/schema";
import type { WordStatus } from "@/lib/db/types";
import { analyzeConjugation, type ConjugationResponse } from "@/app/actions/conjugation";

const statusLabel: Record<WordStatus | "new", { text: string; cls: string }> = {
  new: { text: "New word", cls: "bg-new-tint text-ink-soft" },
  learning: { text: "Learning", cls: "bg-lapis-soft text-lapis" },
  known: { text: "Known", cls: "bg-sabz-soft text-sabz" },
};

/**
 * Bottom sheet showing a tapped word's meaning. Opening it on a new word is
 * what moves the word into "learning" (handled by the parent); the "I know
 * this word" action promotes it straight to "known".
 */
export function WordSheet({
  entry,
  surface,
  status,
  onMarkKnown,
  onClose,
}: {
  entry: LexiconEntry | null;
  surface: string | null;
  status: WordStatus | "new";
  onMarkKnown: () => void;
  onClose: () => void;
}) {
  const [conjugation, setConjugation] = useState<ConjugationResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    setConjugation(null);
    setIsAnalyzing(false);
  }, [surface]);

  const open = surface !== null;
  const badge = statusLabel[status];
  
  const isVerb = entry?.pos === "verb";

  const handleAnalyze = async () => {
    if (!surface || !entry) return;
    setIsAnalyzing(true);
    const result = await analyzeConjugation(surface, entry.dari, entry.glossEn);
    if ("error" in result) {
      alert(result.error);
    } else {
      setConjugation(result);
    }
    setIsAnalyzing(false);
  };

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
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-b-0 border-line bg-surface px-6 pb-10 pt-3 shadow-[0_-8px_40px_rgba(31,26,23,0.12)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
          >
            <div className="mx-auto mb-4 h-1 w-9 shrink-0 rounded-full bg-line" />
            {entry ? (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <p lang="prs" className="text-[36px] leading-snug">
                        {entry.dari}
                      </p>
                    </div>
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

                {isVerb && (
                  <div className="mt-5 border-t border-line pt-5">
                    {conjugation ? (
                      <div className="rounded-2xl border border-line bg-paper/50 p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <h4 className="text-[14px] font-medium text-ink-soft">Conjugation Analysis</h4>
                          <div className="flex items-center gap-1.5 rounded-full bg-lapis/10 px-2.5 py-1 text-[11px] font-medium text-lapis">
                            <Wand2 size={12} /> AI
                          </div>
                        </div>
                        <p className="text-[15px] font-semibold">{conjugation.tense}</p>
                        <p className="mb-4 text-[13px] text-ink-faint">{conjugation.person}</p>
                        
                        <div className="flex flex-col gap-2">
                          {conjugation.conjugation.map((row, i) => (
                            <div key={i} className="flex items-center justify-between rounded-xl bg-surface p-3 shadow-sm border border-line/50">
                              <div className="flex flex-col">
                                <span className="text-[11px] font-medium text-ink-faint uppercase tracking-wider">{row.person}</span>
                                <span className="text-[12px] text-ink-soft mt-0.5">{row.en}</span>
                              </div>
                              <div className="flex flex-col items-end text-right">
                                <span lang="prs" className="text-[18px]">{row.dari}</span>
                                <span className="text-[12px] text-ink-soft">{row.translit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-lapis-soft/50 py-3 text-[14px] font-medium text-lapis transition-colors hover:bg-lapis-soft disabled:opacity-50"
                      >
                        {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                        {isAnalyzing ? "Analyzing tense..." : "Analyze Conjugation (AI)"}
                      </button>
                    )}
                  </div>
                )}

                {status === "known" ? (
                  <p className="mt-5 flex items-center justify-center gap-1.5 text-[14px] font-medium text-sabz">
                    <Check size={16} strokeWidth={2.5} />
                    You know this word
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={onMarkKnown}
                    className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-sabz/40 bg-sabz-soft text-[15px] font-medium text-sabz transition-colors duration-200 hover:bg-sabz/15 active:scale-[0.99]"
                  >
                    <Check size={18} strokeWidth={2.5} />
                    I already know this word
                  </button>
                )}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3">
                  <p lang="prs" className="text-[36px] leading-snug">
                    {surface}
                  </p>
                </div>
                <p className="mt-3 text-[15px] text-ink-soft">
                  Probably a name. It isn&apos;t in the dictionary yet.
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
