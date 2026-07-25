"use client";

import { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { explainSentence } from "@/app/actions/explain";
import type { SentenceExplanation } from "@/lib/ai/explain";
import { Skeleton } from "@/components/ui/skeleton";

export function SentenceSheet({
  sentence,
  open,
  onClose,
}: {
  sentence: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [explanation, setExplanation] = useState<SentenceExplanation | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !sentence) {
      setTimeout(() => {
        setExplanation(null);
        setError(null);
      }, 0);
      return;
    }

    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAnalyzing(true);
    setError(null);

    explainSentence(sentence)
      .then((res) => {
        if (!active) return;
        if ("error" in res) {
          setError(res.error);
        } else {
          setExplanation(res);
        }
      })
      .catch((err) => {
        if (active) setError(String(err));
      })
      .finally(() => {
        if (active) setIsAnalyzing(false);
      });

    return () => {
      active = false;
    };
  }, [sentence, open]);

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
            
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-medium text-ink-soft">Sentence Breakdown</h3>
              <div className="flex items-center gap-1.5 rounded-full bg-lapis/10 px-2.5 py-1 text-[11px] font-medium text-lapis">
                <Sparkles size={12} /> AI
              </div>
            </div>

            <p lang="prs" className="mb-6 leading-snug [text-wrap:balance]" style={{ 
              fontSize: `clamp(20px, calc((100vw - 48px) / ${Math.max(1, sentence.length * 0.45)}), 28px)` 
            }}>
              {sentence}
            </p>

            {isAnalyzing ? (
              <div className="flex flex-col gap-6 py-4 w-full">
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-[72px] w-full rounded-xl" />
                  <Skeleton className="h-[72px] w-full rounded-xl" />
                </div>
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-24 mb-2" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                </div>
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-[14px] text-red-600">
                {error}
              </div>
            ) : explanation ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <h4 className="text-[13px] font-medium text-ink-faint uppercase tracking-wider">Word by Word</h4>
                  <div className="flex flex-col gap-2">
                    {explanation.words.map((word, i) => (
                      <div key={i} className="flex items-center justify-between rounded-xl bg-paper p-3 shadow-sm border border-line/50">
                        <div className="flex flex-col">
                          <span className="text-[14px] font-medium">{word.gloss}</span>
                          {word.role && (
                            <span className="text-[12px] text-ink-soft mt-0.5">{word.role}</span>
                          )}
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <span lang="prs" className="text-[20px] leading-tight">{word.dari}</span>
                          <span className="text-[12px] text-ink-soft">{word.translit}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <h4 className="text-[13px] font-medium text-ink-faint uppercase tracking-wider">Structure</h4>
                  <div className="rounded-xl bg-paper p-4 text-[14px] leading-relaxed border border-line/50">
                    {explanation.structureEn}
                  </div>
                </div>

              </div>

            ) : null}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
