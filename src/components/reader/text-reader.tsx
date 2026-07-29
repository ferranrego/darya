"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, CircleHelp, Highlighter, Trophy, ArrowRight, Languages, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { lexemeById, lexiconIndex, levels } from "@/lib/content/load";
import type { TextDocument } from "@/lib/content/schema";
import { markTextRead } from "@/lib/db/texts";
import { upsertUserWord } from "@/lib/db/words";
import { XP, recordActivity } from "@/lib/gamification";
import { profile as langProfile } from "@/lib/lang";
import { useInvalidateLearning, useProfile, useSupabase, useUser, useWordStatusMap } from "@/lib/queries/hooks";
import { newCard } from "@/lib/srs/scheduler";
import { hapticTap, hapticSuccess } from "@/lib/util/haptics";

import { ReaderGuideSheet } from "./reader-guide-sheet";
import { segmentSentence } from "./segments";
import { WordSheet } from "./word-sheet";
import { SentenceSheet } from "./sentence-sheet";

interface TappedWord {
  surface: string;
  lexemeId: string | null;
  sentenceIndex?: number;
}

export function TextReader({
  doc,
  onFinished,
}: {
  doc: TextDocument;
  onFinished: () => void;
}) {
  const db = useSupabase();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const statusMap = useWordStatusMap();
  const invalidate = useInvalidateLearning();

  const [tapped, setTapped] = useState<TappedWord | null>(null);
  const [tappedSentence, setTappedSentence] = useState<string | null>(null);
  const [tapCount, setTapCount] = useState(0);
  const [expandedSentences, setExpandedSentences] = useState<Set<number>>(new Set());
  const [showTranslit, setShowTranslit] = useState(false);
  const [showSyntax, setShowSyntax] = useState(false);
  const [phase, setPhase] = useState<"reading" | "done">("reading");
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("hasSeenReaderGuide")) return;
    const t = setTimeout(() => {
      setShowGuide(true);
      localStorage.setItem("hasSeenReaderGuide", "true");
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const segments = useMemo(() => {
    return doc.sentences.map((sentence) => {
      return segmentSentence(sentence).map((seg) => {
        if (seg.kind === "word") {
          let id = seg.token.lexemeId;
          if (!id) {
            const resolved = lexiconIndex().resolve(seg.token.surface);
            if (resolved) id = resolved.id;
          }
          const pos = id ? lexemeById(id)?.pos : undefined;
          return { ...seg, resolvedId: id, pos };
        }
        return seg;
      });
    });
  }, [doc]);

  const startLearning = useMutation({
    mutationFn: async ({ lexemeId, sentenceIndex }: { lexemeId: string; sentenceIndex?: number }) => {
      if (!user) return;
      const card = newCard(new Date());
      const sentence = sentenceIndex !== undefined ? doc.sentences[sentenceIndex] : undefined;
      await upsertUserWord(db, {
        user_id: user.id,
        lexeme_id: lexemeId,
        status: "learning",
        due: card.due.toISOString(),
        fsrs: card,
        context_target: sentence?.target ?? null,
        context_translit: sentence?.translit ?? null,
        context_en: sentence?.en ?? null,
      });
      await recordActivity(db, user.id, { words_learned: 1 });
    },
    onSuccess: () => invalidate(),
  });

  const markKnown = useMutation({
    mutationFn: async ({ lexemeId, sentenceIndex }: { lexemeId: string; sentenceIndex?: number }) => {
      if (!user) return;
      const sentence = sentenceIndex !== undefined ? doc.sentences[sentenceIndex] : undefined;
      await upsertUserWord(db, {
        user_id: user.id,
        lexeme_id: lexemeId,
        status: "known",
        due: null,
        fsrs: null,
        context_target: sentence?.target ?? null,
        context_translit: sentence?.translit ?? null,
        context_en: sentence?.en ?? null,
      });
      await recordActivity(db, user.id, { xp: XP.wordLearned });
    },
    onSuccess: () => invalidate(),
  });

  const finish = useMutation({
    mutationFn: async () => {
      if (!user || !profile) return;
      await markTextRead(db, user.id, doc.id, tapCount);
      await recordActivity(db, user.id, { xp: XP.textRead, texts_read: 1 });
      const { count } = await db
        .from("user_words")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "known");
      const eligible = levels.filter((l) => (count ?? 0) >= l.entryKnownWords).at(-1);
      const currentIdx = levels.findIndex((l) => l.id === profile.level_estimate);
      const eligibleIdx = eligible ? levels.findIndex((l) => l.id === eligible.id) : -1;
      if (eligible && eligibleIdx > currentIdx) {
        await db.from("profiles").update({ level_estimate: eligible.id }).eq("id", user.id);
      }
    },
    onSuccess: async () => {
      await invalidate();
      hapticSuccess();
      setPhase("done");
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
  });

  function handleTap(surface: string, lexemeId: string | null, sentenceIndex: number) {
    if (!lexemeId) {
      const resolved = lexiconIndex().resolve(surface);
      if (resolved) lexemeId = resolved.id;
    }
    setTapped({ surface, lexemeId, sentenceIndex });
    setTapCount((c) => c + 1);
    if (lexemeId && statusMap && !statusMap.has(lexemeId)) {
      startLearning.mutate({ lexemeId, sentenceIndex });
    }
  }

  function toggleSentence(i: number) {
    setExpandedSentences((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  const tappedEntry = tapped?.lexemeId ? (lexemeById(tapped.lexemeId) ?? null) : null;
  const tappedStatus = tapped?.lexemeId
    ? (statusMap?.get(tapped.lexemeId) ?? "learning")
    : "new";

  if (phase === "done") {
    return <DoneScreen tapCount={tapCount} onNext={onFinished} />;
  }

  // A smarter dynamic font calculation:
  // We want sentences to ideally fit on a single line on mobile (if they are short).
  // Container width is ~100vw - 48px. An Arabic character takes ~0.45em width.
  // fontSize * maxTargetLength * 0.45 = containerWidth => fontSize = containerWidth / (maxTargetLength * 0.45)
  // We clamp it between 22px (for readability on long B2/C1 texts) and 32px.
  const maxTargetLength = Math.max(...doc.sentences.map(s => s.target.length));
  const optimalFontSize = `clamp(22px, calc((100vw - 48px) / ${Math.max(1, maxTargetLength * 0.45)}), 32px)`;

  return (
    <article className="flex flex-col relative pb-32">
      {/* Compact Editorial Header */}
      <header className="mb-8 mt-4 flex flex-col items-center text-center">
        <h1 lang={langProfile.code} className="text-[30px] font-bold leading-[1.35] text-ink max-w-[300px] mx-auto">
          {doc.titleTarget}
        </h1>
        <div className="mt-2.5 flex flex-col items-center gap-0.5 px-4">
          {/* A Latin-script language has no transliteration; rendering the
              field anyway printed whatever the model invented for it. */}
          {langProfile.capabilities.transliteration && doc.titleTranslit ? (
            <span className="text-[12px] uppercase tracking-widest text-ink-faint font-semibold">
              {doc.titleTranslit}
            </span>
          ) : null}
          <span className="text-[14px] text-ink-soft font-medium">
            {doc.titleEn}
          </span>
        </div>
      </header>

      <div className="flex flex-col gap-6 px-2">
        {doc.sentences.map((sentence, i) => {
          const isExpanded = expandedSentences.has(i);
          // When global translit is on, it's always shown. When off, only shown if sentence is expanded.
          const showLocalTranslit = showTranslit || isExpanded;

          return (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{ duration: 0.6, delay: i * 0.05, ease: [0.21, 0.47, 0.32, 0.98] }}
              className="flex flex-col relative"
            >
              <div className="relative">
                <p lang="prs" className="leading-[1.85] [text-wrap:balance]" style={{ fontSize: optimalFontSize }}>
                  {(() => {
                    const lastWordIdx = segments[i].map(s => s.kind).lastIndexOf("word");
                    const splitIdx = lastWordIdx >= 0 ? lastWordIdx : 0;
                    
                    const renderSeg = (seg: typeof segments[0][0], j: number) => (
                      seg.kind === "text" ? (
                        <span key={j}>{seg.text}</span>
                      ) : (
                        <WordSpan
                          key={j}
                          surface={seg.token.surface}
                          status={seg.resolvedId ? (statusMap?.get(seg.resolvedId) ?? "new") : "name"}
                          onTap={() => handleTap(seg.token.surface, seg.resolvedId, i)}
                          pos={showSyntax ? seg.pos : undefined}
                        />
                      )
                    );

                    return (
                      <>
                        {segments[i].slice(0, splitIdx).map((seg, j) => renderSeg(seg, j))}
                        <span className="whitespace-nowrap">
                          {segments[i].slice(splitIdx).map((seg, j) => renderSeg(seg, splitIdx + j))}
                          <button
                            type="button"
                            onClick={() => {
                              hapticTap();
                              toggleSentence(i);
                            }}
                            className={`inline-flex items-center justify-center rounded-full mr-3 mb-1 align-middle transition-colors ${
                              isExpanded ? "text-lapis" : "text-ink-faint hover:text-ink-soft"
                            }`}
                          >
                            <Languages size={18} strokeWidth={2.5} />
                          </button>
                        </span>
                      </>
                    );
                  })()}
                </p>
              </div>

              {/* Contextual Reveal */}
              <AnimatePresence>
                {(isExpanded || showLocalTranslit) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden flex flex-col gap-1.5"
                  >
                    <div className="pt-3 border-t border-line/40 mt-3 flex flex-col gap-1.5">
                      {showLocalTranslit && (
                        <p className="text-[15px] font-medium leading-relaxed text-ink-soft/90">
                          {sentence.translit}
                        </p>
                      )}
                      {isExpanded && (
                        <div className="flex flex-col gap-3">
                          <p className="text-[15px] leading-relaxed text-ink-faint">
                            {sentence.en}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              hapticTap();
                              setTappedSentence(sentence.target);
                            }}
                            className="inline-flex w-fit items-center gap-1.5 rounded-full bg-surface py-1.5 px-3 text-[12px] font-medium text-lapis shadow-sm ring-1 ring-inset ring-line/50 transition-transform active:scale-95"
                          >
                            <Sparkles size={14} />
                            Explain syntax
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Floating Global Action Pill */}
      <div className="fixed bottom-[calc(var(--tab-bar-h)+24px)] left-1/2 z-40 -translate-x-1/2">
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.2 }}
          className="flex items-center gap-1.5 rounded-full bg-surface/90 p-2 shadow-lg ring-1 ring-inset ring-black/5 backdrop-blur-xl"
        >
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink-faint hover:bg-surface hover:text-ink transition-colors opacity-50 cursor-not-allowed"
            title="Previous text (coming soon)"
          >
            <ChevronLeft size={20} />
          </button>

          <div className="mx-0.5 h-6 w-px bg-line/80" />

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setShowSyntax((v) => !v);
              }}
              aria-pressed={showSyntax}
              className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                showSyntax ? "bg-lapis-soft text-lapis" : "text-ink-soft hover:bg-surface hover:text-ink"
              }`}
            >
              <Highlighter size={18} />
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setShowTranslit((v) => !v);
              }}
              aria-pressed={showTranslit}
              className={`flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                showTranslit ? "bg-lapis-soft text-lapis" : "text-ink-soft hover:bg-surface hover:text-ink"
              }`}
            >
              abc
            </button>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setShowGuide(true);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            >
              <CircleHelp size={18} />
            </button>
          </div>

          <div className="mx-0.5 h-6 w-px bg-line/80" />

          <button
            type="button"
            onClick={() => {
              hapticTap();
              finish.mutate();
            }}
            disabled={finish.isPending}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-lapis-soft text-lapis transition-all active:scale-95 disabled:opacity-50"
            title="Finish text"
          >
            <ChevronRight size={20} strokeWidth={2.5} className={finish.isPending ? "animate-pulse" : ""} />
          </button>
        </motion.div>
      </div>

      {showSyntax && (
        <div className="fixed bottom-[calc(var(--tab-bar-h)+90px)] left-4 right-4 z-40">
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="mx-auto flex max-w-sm flex-wrap justify-center gap-1.5 rounded-2xl bg-surface/95 p-3 shadow-xl ring-1 ring-inset ring-black/5 backdrop-blur-xl"
          >
            <SyntaxBadge color="bg-red-500" label="Verb" />
            <SyntaxBadge color="bg-blue-500" label="Noun" />
            <SyntaxBadge color="bg-emerald-500" label="Adjective" />
            <SyntaxBadge color="bg-orange-500" label="Adverb" />
            <SyntaxBadge color="bg-purple-500" label="Pronoun" />
            <SyntaxBadge color="bg-teal-500" label="Preposition" />
            <SyntaxBadge color="bg-amber-500" label="Conjunction" />
            <SyntaxBadge color="bg-pink-500" label="Particle" />
            <SyntaxBadge color="bg-cyan-600" label="Determiner" />
            <SyntaxBadge color="bg-indigo-500" label="Numeral" />
          </motion.div>
        </div>
      )}

      <WordSheet
        entry={tappedEntry}
        surface={tapped?.surface ?? null}
        status={tappedStatus}
        onMarkKnown={() => {
          if (tapped?.lexemeId) markKnown.mutate({ lexemeId: tapped.lexemeId, sentenceIndex: tapped.sentenceIndex });
        }}
        onClose={() => setTapped(null)}
      />

      <SentenceSheet
        sentence={tappedSentence}
        open={tappedSentence !== null}
        onClose={() => setTappedSentence(null)}
      />

      <ReaderGuideSheet open={showGuide} onClose={() => setShowGuide(false)} />
    </article>
  );
}

function SyntaxBadge({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-ink-soft">
      <div className={`size-2 rounded-full ${color}`} />
      {label}
    </div>
  );
}

function DoneScreen({
  tapCount,
  onNext,
}: {
  tapCount: number;
  onNext: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative flex min-h-[70vh] flex-col items-center justify-center p-6 text-center"
    >
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[90vw] w-[90vw] max-w-lg rounded-full bg-gradient-to-br from-sabz/20 via-saffron/20 to-lapis/10 blur-[80px]" />
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
          className="relative flex size-28 items-center justify-center rounded-full bg-surface shadow-2xl ring-1 ring-black/5"
        >
          <div className="absolute inset-0 rounded-full bg-sabz-soft/40 animate-pulse" />
          <Check size={48} className="text-sabz relative z-10" strokeWidth={2.5} />
        </motion.div>
        
        <motion.h2 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mt-10 text-[36px] font-bold tracking-tight text-ink"
        >
          Outstanding!
        </motion.h2>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mt-8 flex w-full flex-col gap-4 rounded-3xl bg-surface/60 p-6 shadow-lg ring-1 ring-inset ring-line/50 backdrop-blur-xl"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-ink-soft">
              <div className="flex size-8 items-center justify-center rounded-full bg-saffron-soft text-saffron">
                <Trophy size={16} />
              </div>
              <span className="text-[16px] font-medium">XP Earned</span>
            </div>
            <span className="text-[22px] font-bold text-ink">+{XP.textRead}</span>
          </div>
          
          {tapCount > 0 && (
            <div className="flex items-center justify-between pt-4 border-t border-line/40">
              <div className="flex items-center gap-2.5 text-ink-soft">
                <div className="flex size-8 items-center justify-center rounded-full bg-lapis-soft text-lapis">
                  <CircleHelp size={16} />
                </div>
                <span className="text-[16px] font-medium">Words Explored</span>
              </div>
              <span className="text-[20px] font-bold text-ink">{tapCount}</span>
            </div>
          )}
        </motion.div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6, ease: [0.21, 0.47, 0.32, 0.98] }}
          className="mt-12 w-full"
        >
          <Button 
            size="lg" 
            className="w-full h-14 rounded-full text-[17px] shadow-xl group relative overflow-hidden bg-ink hover:bg-ink-soft transition-all active:scale-[0.98]" 
            onClick={() => {
              hapticTap();
              onNext();
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2 text-surface">
              Next text
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
            </span>
          </Button>
        </motion.div>
      </div>
    </motion.div>
  );
}

function WordSpan({
  surface,
  status,
  onTap,
  pos,
}: {
  surface: string;
  status: "new" | "learning" | "known" | "name";
  onTap: () => void;
  pos?: string;
}) {
  const isSyntax = pos !== undefined;

  // Elevated Word styling for native feel
  const statusCls =
    status === "new"
      ? `bg-ink/5 ring-1 ring-inset ring-ink/10 rounded-md px-1 ${isSyntax ? "" : "text-ink"}`
      : status === "learning"
        ? `underline decoration-lapis/40 decoration-[3px] underline-offset-[6px] font-medium ${isSyntax ? "" : "text-lapis-deep"}`
        : "";

  let posCls = isSyntax ? "" : "text-ink";
  if (pos === "verb") posCls = "text-red-500 font-medium";
  else if (pos === "noun") posCls = "text-blue-500";
  else if (pos === "adjective") posCls = "text-emerald-500";
  else if (pos === "adverb") posCls = "text-orange-500";
  else if (pos === "pronoun") posCls = "text-purple-500 font-medium";
  else if (pos === "preposition") posCls = "text-teal-500";
  else if (pos === "conjunction") posCls = "text-amber-500";
  else if (pos === "particle") posCls = "text-pink-500";
  else if (pos === "determiner") posCls = "text-cyan-600";
  else if (pos === "numeral") posCls = "text-indigo-500";

  return (
    <motion.button
      type="button"
      layout="position"
      onClick={() => {
        hapticTap();
        onTap();
      }}
      whileTap={{ scale: 0.95 }}
      transition={{ layout: { type: "spring", stiffness: 400, damping: 30 } }}
      className={`-mx-[2px] inline cursor-pointer px-[2px] py-1 transition-colors hover:bg-line/20 active:bg-line/40 rounded ${statusCls} ${posCls}`}
    >
      {surface}
    </motion.button>
  );
}
