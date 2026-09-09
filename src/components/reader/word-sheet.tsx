"use client";

import { useState, useEffect } from "react";
import { Check, Loader2, Wand2 } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { LexiconEntry } from "@/lib/content/schema";
import type { WordStatus } from "@/lib/db/types";
import { analyzeConjugation, type ConjugationResponse } from "@/app/actions/conjugation";
import { profile as langProfile } from "@/lib/lang";

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
  lookupState = "none",
  lookupMessage,
  usedAsName = false,
}: {
  entry: LexiconEntry | null;
  surface: string | null;
  status: WordStatus | "new";
  onMarkKnown: () => void;
  onClose: () => void;
  /**
   * What is happening for a word with no entry. In a curriculum text an
   * unresolved token really is a name; in an imported article it is usually an
   * ordinary word being looked up, so "Probably a name" would be wrong for the
   * common case.
   */
  lookupState?: "none" | "loading" | "failed" | "name";
  /**
   * What actually went wrong, from the server. The route classifies the failure
   * - out of quota, too slow, or a request the models cannot handle - because
   * "try again in a moment" is only true for some of those, and was shown for
   * all of them.
   */
  lookupMessage?: string;
  /**
   * The word is part of a proper name in this sentence, but is an ordinary word
   * in its own right - which is the usual case for the words personal and place
   * names are built from. The meaning is still what the learner tapped for; this
   * only explains why it looks odd here.
   */
  usedAsName?: boolean;
}) {
  const [conjugation, setConjugation] = useState<ConjugationResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  useEffect(() => {
    setTimeout(() => {
      setConjugation(null);
      setIsAnalyzing(false);
      setAnalyzeError(null);
    }, 0);
  }, [surface]);

  const open = surface !== null;
  const badge = statusLabel[status];
  
  const isVerb = entry?.pos === "verb";

  const handleAnalyze = async () => {
    if (!surface || !entry) return;
    setIsAnalyzing(true);
    setAnalyzeError(null);
    const result = await analyzeConjugation(surface, entry.target, entry.glossEn);
    if ("error" in result) {
      // In-sheet, not a native alert() - the sheet already has an error
      // pattern (see sentence-sheet.tsx) and a native dialog breaks the
      // whole visual language, jarringly so on mobile.
      setAnalyzeError(result.error);
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
                      <p lang={langProfile.code} className="text-[35px] leading-snug">
                        {entry.target}
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
                {/* Names are very often built from ordinary words. Saying so is
                    the difference between a learner thinking the app got it
                    wrong and them understanding why a word for "king" is
                    sitting in the middle of somebody's name. */}
                {usedAsName ? (
                  <p className="mt-2.5 rounded-xl bg-paper px-3.5 py-2.5 text-[13px] leading-relaxed text-ink-soft">
                    Here it&apos;s part of a name - but this is what the word itself means.
                  </p>
                ) : null}
                <div className="mt-5 rounded-2xl bg-paper p-4">
                  <p lang={langProfile.code} className="text-[19px] leading-loose">
                    {entry.exampleTarget}
                  </p>
                  {/* A personal entry may carry no transliteration, and a
                      Latin-script build never has one. */}
                  {entry.exampleTranslit ? (
                    <p className="mt-1 text-[13px] text-ink-soft">{entry.exampleTranslit}</p>
                  ) : null}
                  <p className="mt-0.5 text-[13px] text-ink-faint">{entry.exampleEn}</p>
                </div>

                {isVerb && (
                  <div className="mt-5 border-t border-line pt-5">
                    {analyzeError ? (
                      <div className="flex flex-col gap-3">
                        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-[14px] text-red-600">
                          {analyzeError}
                        </div>
                        <button
                          type="button"
                          onClick={handleAnalyze}
                          disabled={isAnalyzing}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lapis-soft/50 py-3 text-[14px] font-medium text-lapis transition-colors hover:bg-lapis-soft disabled:opacity-50"
                        >
                          {isAnalyzing ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
                          {isAnalyzing ? "Analyzing tense..." : "Try again"}
                        </button>
                      </div>
                    ) : conjugation ? (
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
                                <span lang={langProfile.code} className="text-[18px]">{row.target}</span>
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
                  <p lang={langProfile.code} className="text-[35px] leading-snug">
                    {surface}
                  </p>
                </div>
                {/* A name is an answer, not a failure. This branch used to say
                    "couldn't look this word up" for a proper noun the model had
                    identified perfectly well - so a learner who tapped the
                    middle word of a three-part personal name in a news article
                    was told the app was broken. */}
                {lookupState === "loading" ? (
                  <p className="mt-3 text-[15px] text-ink-soft">Looking this word up…</p>
                ) : lookupState === "failed" ? (
                  <p className="mt-3 rounded-xl bg-ink/5 px-4 py-3 text-[15px] leading-relaxed text-ink-soft">
                    {lookupMessage ?? "Couldn't look this word up. Tap it again to retry."}
                  </p>
                ) : (
                  <>
                    <p className="mt-3 text-[15px] text-ink-soft">
                      A name - a person, place or organisation.
                    </p>
                    <p className="mt-1.5 text-[14px] text-ink-faint">
                      Nothing to learn here, so it won&apos;t be added to your words.
                    </p>
                  </>
                )}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
