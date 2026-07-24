"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, CircleHelp, Languages, Highlighter, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { lexemeById, lexiconIndex, levels } from "@/lib/content/load";
import type { TextDocument } from "@/lib/content/schema";
import { markTextRead } from "@/lib/db/texts";
import { upsertUserWord } from "@/lib/db/words";
import { XP, recordActivity } from "@/lib/gamification";
import { useInvalidateLearning, useProfile, useSupabase, useUser, useWordStatusMap } from "@/lib/queries/hooks";
import { newCard } from "@/lib/srs/scheduler";

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
  const [revealedEn, setRevealedEn] = useState<Set<number>>(new Set());
  const [revealedTranslit, setRevealedTranslit] = useState<Set<number>>(new Set());
  const [showTranslit, setShowTranslit] = useState(false);
  const [showSyntax, setShowSyntax] = useState(false);
  const [phase, setPhase] = useState<"reading" | "done">("reading");
  const [showGuide, setShowGuide] = useState(false);

  // First ever visit: open the guide once the reader has settled.
  useEffect(() => {
    if (localStorage.getItem("hasSeenReaderGuide")) return;
    const t = setTimeout(() => {
      setShowGuide(true);
      localStorage.setItem("hasSeenReaderGuide", "true");
    }, 600);
    return () => clearTimeout(t);
  }, []);

  const segments = useMemo(() => doc.sentences.map(segmentSentence), [doc]);

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
        context_dari: sentence?.dari ?? null,
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
        context_dari: sentence?.dari ?? null,
        context_translit: sentence?.translit ?? null,
        context_en: sentence?.en ?? null,
      });
      // A word tapped this session was already counted toward words_learned;
      // reward the promotion with XP and leave the daily count untouched.
      await recordActivity(db, user.id, { xp: XP.wordLearned });
    },
    onSuccess: () => invalidate(),
  });

  const finish = useMutation({
    mutationFn: async () => {
      if (!user || !profile) return;
      await markTextRead(db, user.id, doc.id, tapCount);
      await recordActivity(db, user.id, { xp: XP.textRead, texts_read: 1 });
      // Level advancement: promote when the known-word count clears the next
      // level's entry threshold.
      const { count } = await db
        .from("user_words")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("status", "known");
      const eligible = levels.filter((l) => (count ?? 0) >= l.entryKnownWords).at(-1);
      const currentIdx = levels.findIndex((l) => l.id === profile.level_estimate);
      const eligibleIdx = eligible ? levels.findIndex((l) => l.id === eligible.id) : -1;
      // Promote only: the assessment may estimate a higher level than the
      // seeded known-word rows alone would justify; never demote.
      if (eligible && eligibleIdx > currentIdx) {
        await db.from("profiles").update({ level_estimate: eligible.id }).eq("id", user.id);
      }
    },
    onSuccess: async () => {
      await invalidate();
      setPhase("done");
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

  function toggleEn(i: number) {
    setRevealedEn((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // Per-sentence transliteration flips the global toggle for that sentence:
  // reveals it when the global toggle is off, hides it when on.
  function toggleTranslit(i: number) {
    setRevealedTranslit((prev) => {
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
    return (
      <DoneScreen
        tapCount={tapCount}
        onNext={onFinished}
      />
    );
  }

  return (
    <motion.article
      key={doc.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="flex flex-col"
    >
      <header className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 lang="prs" className="text-[34px] leading-snug">
            {doc.titleDari}
          </h1>
          <p className="mt-1 text-[14px] text-ink-soft">
            {doc.titleTranslit} · {doc.titleEn}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            title="How reading works"
            className="mt-2 flex size-10 shrink-0 items-center justify-center rounded-full border border-line text-ink-faint transition-colors hover:text-ink-soft"
          >
            <CircleHelp size={18} />
          </button>
          <button
            type="button"
            onClick={() => setShowSyntax((v) => !v)}
            aria-pressed={showSyntax}
            title="Toggle grammar highlighting"
            className={`mt-2 flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors ${
              showSyntax ? "border-lapis bg-lapis-soft text-lapis" : "border-line text-ink-faint hover:text-ink-soft"
            }`}
          >
            <Highlighter size={18} />
          </button>
          <button
            type="button"
            onClick={() => {
              setShowTranslit((v) => !v);
              setRevealedTranslit(new Set());
            }}
            aria-pressed={showTranslit}
            title="Show transliteration"
            className={`mt-2 flex size-10 shrink-0 items-center justify-center rounded-full border text-[13px] font-medium transition-colors ${
              showTranslit ? "border-lapis bg-lapis-soft text-lapis" : "border-line text-ink-faint hover:text-ink-soft"
            }`}
          >
            abc
          </button>
        </div>
      </header>

      {showSyntax && (
        <motion.div
          initial={{ height: 0, opacity: 0, marginBottom: 0 }}
          animate={{ height: "auto", opacity: 1, marginBottom: 24 }}
          className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl bg-surface-50 p-4 text-[13px] border border-line overflow-hidden"
        >
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-red-500" />Verb</div>
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-blue-500" />Noun</div>
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-emerald-500" />Adjective</div>
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-orange-500" />Adverb</div>
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-purple-500" />Pronoun</div>
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-teal-500" />Preposition</div>
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-amber-500" />Conjunction</div>
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-pink-500" />Particle</div>
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-cyan-600" />Determiner</div>
          <div className="flex items-center gap-2"><div className="size-2.5 rounded-full bg-indigo-500" />Numeral</div>
        </motion.div>
      )}

      <div className="flex flex-col gap-4">
        {doc.sentences.map((sentence, i) => (
          <div key={i}>
            <p lang="prs" className="text-[28px] leading-[2.1]">
              {segments[i].map((seg, j) =>
                seg.kind === "text" ? (
                  <span key={j}>{seg.text}</span>
                ) : (
                  <WordSpan
                    key={j}
                    surface={seg.token.surface}
                    status={(() => {
                      let id = seg.token.lexemeId;
                      if (!id) {
                        const resolved = lexiconIndex().resolve(seg.token.surface);
                        if (resolved) id = resolved.id;
                      }
                      return id ? (statusMap?.get(id) ?? "new") : "name";
                    })()}
                    onTap={() => handleTap(seg.token.surface, seg.token.lexemeId, i)}
                    pos={(() => {
                      if (!showSyntax) return undefined;
                      let id = seg.token.lexemeId;
                      if (!id) {
                        const resolved = lexiconIndex().resolve(seg.token.surface);
                        if (resolved) id = resolved.id;
                      }
                      if (!id) return undefined;
                      const entry = lexemeById(id);
                      return entry?.pos;
                    })()}
                  />
                ),
              )}
            </p>
            {(showTranslit !== revealedTranslit.has(i)) && (
              <p className="mt-1 text-[14px] leading-relaxed text-ink-faint">{sentence.translit}</p>
            )}
            {revealedEn.has(i) && (
              <p className="mt-1 text-[13px] leading-relaxed text-ink-soft">{sentence.en}</p>
            )}
            <div className="mt-1.5 flex items-center gap-1">
              <button
                type="button"
                onClick={() => toggleTranslit(i)}
                aria-pressed={showTranslit !== revealedTranslit.has(i)}
                aria-label="Show transliteration"
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  showTranslit !== revealedTranslit.has(i)
                    ? "bg-lapis-soft text-lapis"
                    : "text-ink-faint/70 hover:text-lapis"
                }`}
              >
                abc
              </button>
              <button
                type="button"
                onClick={() => toggleEn(i)}
                aria-pressed={revealedEn.has(i)}
                aria-label="Translate to English"
                className={`rounded-full p-1 transition-colors flex items-center justify-center ${
                  revealedEn.has(i)
                    ? "bg-lapis-soft text-lapis"
                    : "text-ink-faint/70 hover:text-lapis"
                }`}
              >
                <Languages size={13} />
              </button>
              <button
                type="button"
                onClick={() => setTappedSentence(sentence.dari)}
                aria-label="Explain this sentence"
                className="rounded-full p-1 transition-colors flex items-center justify-center text-ink-faint/70 hover:text-lapis"
              >
                <Sparkles size={13} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-14 flex justify-center pb-4">
        <Button size="lg" onClick={() => finish.mutate()} disabled={finish.isPending}>
          {finish.isPending ? "Saving…" : "Finish text"}
        </Button>
      </div>

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
    </motion.article>
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
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="flex flex-1 flex-col items-center justify-center py-24 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.1 }}
        className="flex size-16 items-center justify-center rounded-full bg-sabz-soft text-sabz"
      >
        <Check size={30} strokeWidth={2.5} />
      </motion.div>
      <h2 className="mt-6 text-[22px] font-semibold tracking-tight">Text finished</h2>
      <p className="mt-2 text-[15px] text-ink-soft">
        +{XP.textRead} XP{tapCount > 0 ? ` · ${tapCount} words explored` : ""}
      </p>
      <Button size="lg" className="mt-10" onClick={onNext}>
        Next text
      </Button>
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
  // Known words render as plain text: the marks fading away once a word is
  // mastered is the encoding itself (explained in ReaderGuideSheet).
  const statusCls =
    status === "new"
      ? "bg-new-tint rounded-md"
      : status === "learning"
        ? "underline decoration-lapis decoration-2 underline-offset-8 font-medium"
        : "";

  let posCls = "text-ink";
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
    <button
      type="button"
      onClick={onTap}
      className={`-mx-0.5 inline cursor-pointer px-0.5 py-1 transition-colors duration-300 hover:opacity-80 ${statusCls} ${posCls}`}
    >
      {surface}
    </button>
  );
}
