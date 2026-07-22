"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, RotateCcw, Sparkles, Brain, BookOpen, TrendingUp } from "lucide-react";
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useEffect } from "react";
import { Poncha, type PonchaPose } from "@/components/poncha";
import { Button } from "@/components/ui/button";
import { lexemeById } from "@/lib/content/load";
import { segmentForHighlight } from "@/lib/text/highlight";
import { logReview, upsertUserWord } from "@/lib/db/words";
import type { UserWordRow } from "@/lib/db/types";
import { XP, recordActivity } from "@/lib/gamification";
import { useInvalidateLearning, useSupabase, useUser, useUserWords } from "@/lib/queries/hooks";
import {
  isGraduated,
  previewIntervals,
  reviewCard,
  reviveCard,
  type TwoButtonGrade,
} from "@/lib/srs/scheduler";
import { PracticeSession } from "@/components/exercises/practice-session";

const SESSION_CAP = 40;

type SessionStats = {
  totalReps: number;
  uniqueReviewed: Set<string>;
  forgotIds: Set<string>;
  graduatedIds: string[];
};

export default function ReviewPage() {
  const db = useSupabase();
  const { data: user } = useUser();
  const { data: words, isLoading } = useUserWords();
  const invalidate = useInvalidateLearning();
  const router = useRouter();

  const [mode, setMode] = useState<"srs" | "practice">("srs");

  // Snapshot the queue once per session so grading doesn't reshuffle it.
  const [queue, setQueue] = useState<UserWordRow[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [exitDir, setExitDir] = useState<1 | -1>(1);

  // Swipe animation values
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-10, 10]);
  const opacityGotIt = useTransform(x, [0, 100], [0, 1]);
  const opacityForgot = useTransform(x, [0, -100], [0, 1]);

  useEffect(() => {
    x.set(0);
  }, [index, queue, x]);

  useEffect(() => {
    if (revealed) {
      const hasSeen = localStorage.getItem("hasSeenSwipeHint");
      if (!hasSeen) {
        setTimeout(() => {
          animate(x, [0, -15, 20, -15, 0], { duration: 0.5 });
          localStorage.setItem("hasSeenSwipeHint", "true");
        }, 300);
      }
    }
  }, [revealed, x]);

  // Persistent session stats
  const statsRef = useRef<SessionStats>({
    totalReps: 0,
    uniqueReviewed: new Set(),
    forgotIds: new Set(),
    graduatedIds: [],
  });

  const due = useMemo(() => {
    if (!words) return null;
    const now = Date.now();
    return words
      .filter((w) => w.status === "learning" && w.due && new Date(w.due).getTime() <= now && w.fsrs)
      .sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime())
      .slice(0, SESSION_CAP);
  }, [words]);

  useEffect(() => {
    if (queue === null && due !== null) {
      setQueue(due);
    }
  }, [queue, due]);

  const grade = useMutation({
    mutationFn: async ({ row, g }: { row: UserWordRow; g: TwoButtonGrade }) => {
      if (!user) return { graduated: false, entryId: row.lexeme_id };
      const now = new Date();
      const { card, log } = reviewCard(reviveCard(row.fsrs!), g, now);
      const graduated = isGraduated(card);
      await upsertUserWord(db, {
        user_id: user.id,
        lexeme_id: row.lexeme_id,
        status: graduated ? "known" : "learning",
        due: card.due.toISOString(),
        fsrs: card,
      });
      await logReview(db, user.id, row.lexeme_id, log.rating, log);
      await recordActivity(db, user.id, {
        xp: XP.review + (graduated ? XP.wordLearned : 0),
        reviews_done: 1,
      });
      return { graduated, entryId: row.lexeme_id };
    },
    onSuccess: (result) => {
      if (!result) return;
      const s = statsRef.current;
      s.totalReps += 1;
      s.uniqueReviewed.add(result.entryId);
      if (result.graduated) s.graduatedIds.push(result.entryId);
    },
  });

  function answer(g: TwoButtonGrade) {
    if (!queue) return;
    const row = queue[index];
    setExitDir(g === "got_it" ? 1 : -1);

    // Track forgot words
    if (g === "forgot") {
      statsRef.current.forgotIds.add(row.lexeme_id);
      // Re-queue at the end so the user must see it again this session
      setQueue((q) => (q ? [...q, row] : [row]));
    }

    grade.mutate({ row, g });
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (isLoading || queue === null) {
    return <div className="flex flex-1 items-center justify-center py-32 text-ink-faint">Loading…</div>;
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <SegmentedControl mode={mode} setMode={setMode} />
        {mode === "practice" ? (
          <PracticeSession onFinish={() => router.push("/")} />
        ) : (
          <EmptyState
            poncha="sleep"
            icon={<Check size={24} />}
            title="All caught up"
            body="Nothing due right now — Poncha's taking a nap. Try a Practice session!"
          />
        )}
      </div>
    );
  }

  if (index >= queue.length) {
    const s = statsRef.current;
    return (
      <SessionDone
        totalReps={s.totalReps}
        uniqueCount={s.uniqueReviewed.size}
        forgotCount={s.forgotIds.size}
        graduatedIds={s.graduatedIds}
        onExit={() => {
          invalidate();
          router.push("/");
        }}
      />
    );
  }

  const row = queue[index];
  const entry = lexemeById(row.lexeme_id);
  if (!entry) {
    return <EmptyState icon={<RotateCcw size={24} />} title="Hmm" body="A reviewed word is missing from the dictionary." />;
  }

  // Compute interval hints for the current card
  const now = new Date();
  const intervals = row.fsrs ? previewIntervals(reviveCard(row.fsrs), now) : null;

  // Verbs are always tested in isolation (conjugated forms are too irregular
  // to reinforce the infinitive). For other words, only show the stored
  // context sentence when we can actually highlight the word in it.
  const contextSegments =
    row.context_dari && entry.pos !== "verb"
      ? segmentForHighlight(row.context_dari, entry.id)
      : null;
  const showContext = contextSegments !== null;

  return (
    <div className="flex flex-1 flex-col">
      <SegmentedControl mode={mode} setMode={setMode} />
      
      {mode === "practice" ? (
        <PracticeSession onFinish={() => setMode("srs")} />
      ) : (
        <div className="flex flex-1 flex-col">
          <div className="mb-6 flex items-center gap-3 pt-2 px-4">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/70">
              <div
                className="h-full rounded-full bg-lapis transition-all duration-300"
                style={{ width: `${(index / queue.length) * 100}%` }}
              />
            </div>
            <span className="text-[13px] tabular-nums text-ink-faint">
              {index + 1}/{queue.length}
            </span>
          </div>

      <div className="relative flex flex-1 items-center justify-center">
        <AnimatePresence mode="wait" onExitComplete={() => x.set(0)}>
          <motion.div
            key={`${row.lexeme_id}-${index}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: exitDir * 60, transition: { duration: 0.2 } }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            style={{ x, rotate }}
            drag={revealed ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.6}
            onDragEnd={(e, { offset, velocity }) => {
              const swipePower = Math.abs(offset.x) * velocity.x;
              if (offset.x > 100 || swipePower > 500) {
                answer("got_it");
              } else if (offset.x < -100 || swipePower < -500) {
                answer("forgot");
              } else {
                animate(x, 0, { type: "spring", stiffness: 300, damping: 20 });
              }
            }}
            className="w-full max-w-md rounded-3xl border border-line bg-surface px-8 py-12 text-center shadow-[0_2px_20px_rgba(31,26,23,0.05)] relative overflow-hidden"
          >
            {/* Swipe Overlays */}
            {revealed && (
              <>
                <motion.div style={{ opacity: opacityGotIt }} className="pointer-events-none absolute inset-0 bg-sabz-soft/40 flex items-center justify-center z-20">
                  <span className="text-sabz font-bold text-2xl uppercase tracking-widest bg-surface/90 px-5 py-2.5 rounded-2xl shadow-sm border border-sabz/20">Got it</span>
                </motion.div>
                <motion.div style={{ opacity: opacityForgot }} className="pointer-events-none absolute inset-0 bg-red-500/10 flex items-center justify-center z-20">
                  <span className="text-red-500 font-bold text-2xl uppercase tracking-widest bg-surface/90 px-5 py-2.5 rounded-2xl shadow-sm border border-red-500/20">Forgot</span>
                </motion.div>
              </>
            )}

            <div className="relative z-10">
              {showContext ? (
                <p lang="prs" className="text-[28px] leading-[2.1] cursor-default select-none">
                  {contextSegments!.map((seg, i) =>
                    seg.hit ? (
                      <span key={i} className="text-lapis font-semibold">{seg.text}</span>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    )
                  )}
                </p>
              ) : (
                <p lang="prs" className="text-[52px] leading-snug cursor-default select-none">
                  {entry.dari}
                </p>
              )}
            <AnimatePresence mode="wait">
              {revealed ? (
                <motion.div
                  key="answer"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4"
                >
                  <p className="text-[16px] text-ink-soft">
                    {showContext ? row.context_translit || entry.translit : entry.translit}
                  </p>
                  <p className="mt-2 text-[22px] font-medium">
                    {showContext ? row.context_en || entry.glossEn : entry.glossEn}
                  </p>

                  {/* If we showed context, still show the dictionary definition to clarify the exact word */}
                  {showContext && (
                    <div className="mt-6 flex flex-col items-center rounded-2xl bg-lapis-soft/30 px-6 py-3 border border-lapis/20">
                      <span lang="prs" className="text-[40px] font-bold text-lapis-dark mb-1">{entry.dari}</span>
                      <div className="flex items-center gap-2 text-[16px] text-lapis-dark/80">
                        <span>{entry.translit}</span>
                        <span className="opacity-40">•</span>
                        <span className="font-medium">{entry.glossEn}</span>
                      </div>
                    </div>
                  )}

                  {!showContext && (
                    <div className="mt-6 rounded-2xl bg-paper px-4 py-3">
                      <p lang="prs" className="text-[18px] leading-loose">
                        {entry.exampleDari}
                      </p>
                      <p className="mt-0.5 text-[12px] text-ink-faint">{entry.exampleEn}</p>
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.p
                  key="prompt"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="mt-4 text-[14px] text-ink-faint"
                >
                  Do you remember this word?
                </motion.p>
              )}
            </AnimatePresence>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pb-6 pt-8">
        {revealed ? (
          <div className="mx-auto max-w-md space-y-2">
            {/* Interval hints above the buttons */}
            {intervals && (
              <div className="flex gap-3 px-0.5">
                <p className="flex-1 text-center text-[11px] font-medium text-red-400/80">{intervals.forgot}</p>
                <p className="flex-1 text-center text-[11px] font-medium text-sabz/80">{intervals.got_it}</p>
              </div>
            )}
            <div className="flex gap-3">
              <Button variant="secondary" size="lg" className="flex-1" onClick={() => answer("forgot")}>
                Forgot
              </Button>
              <Button size="lg" className="flex-1" onClick={() => answer("got_it")}>
                Got it
              </Button>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-md">
            <Button size="lg" className="w-full" onClick={() => setRevealed(true)}>
              Show answer
            </Button>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}

function SessionDone({
  totalReps,
  uniqueCount,
  forgotCount,
  graduatedIds,
  onExit,
}: {
  totalReps: number;
  uniqueCount: number;
  forgotCount: number;
  graduatedIds: string[];
  onExit: () => void;
}) {
  const stillLearning = uniqueCount - graduatedIds.length;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-1 flex-col items-center justify-center py-24 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.1 }}
        className="flex size-16 items-center justify-center rounded-full bg-sabz-soft text-sabz"
      >
        <Sparkles size={28} />
      </motion.div>
      <h2 className="mt-6 text-[22px] font-semibold tracking-tight">Session complete</h2>
      <p className="mt-1 text-[14px] text-ink-faint">{totalReps} rep{totalReps === 1 ? "" : "s"} across {uniqueCount} word{uniqueCount === 1 ? "" : "s"}</p>

      {/* Stats grid */}
      <div className="mt-8 grid w-full max-w-sm grid-cols-3 gap-3">
        <StatCard
          icon={<TrendingUp size={16} />}
          value={graduatedIds.length}
          label="Mastered"
          color="sabz"
        />
        <StatCard
          icon={<BookOpen size={16} />}
          value={stillLearning}
          label="Learning"
          color="lapis"
        />
        <StatCard
          icon={<Brain size={16} />}
          value={forgotCount}
          label="Forgot"
          color="red"
        />
      </div>

      {/* Graduated words */}
      {graduatedIds.length > 0 && (
        <div className="mt-6 w-full max-w-sm">
          <p className="mb-2 text-[12px] font-medium uppercase tracking-widest text-ink-faint">Newly mastered</p>
          <div className="flex flex-wrap justify-center gap-2">
            {graduatedIds.map((id) => {
              const e = lexemeById(id);
              return e ? (
                <span key={id} lang="prs" className="rounded-full bg-sabz-soft px-3.5 py-1 text-[18px] text-sabz">
                  {e.dari}
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      <Button size="lg" className="mt-10" onClick={onExit}>
        Done
      </Button>
    </motion.div>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  color: "sabz" | "lapis" | "red";
}) {
  const colorMap = {
    sabz: "text-sabz bg-sabz-soft",
    lapis: "text-lapis bg-lapis/10",
    red: "text-red-500 bg-red-50",
  } as const;

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-4">
      <div className={`flex size-8 items-center justify-center rounded-full ${colorMap[color]}`}>
        {icon}
      </div>
      <p className="text-[22px] font-semibold tabular-nums leading-none">{value}</p>
      <p className="text-[11px] text-ink-faint">{label}</p>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
  poncha,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  poncha?: PonchaPose;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-24 text-center">
      {poncha ? (
        <Poncha pose={poncha} size={150} />
      ) : (
        <div className="flex size-14 items-center justify-center rounded-full bg-sabz-soft text-sabz">{icon}</div>
      )}
      <h2 className="mt-6 text-[20px] font-semibold">{title}</h2>
      <p className="mt-2 text-[15px] text-ink-soft max-w-[280px]">{body}</p>
    </div>
  );
}

function SegmentedControl({ mode, setMode }: { mode: "srs" | "practice", setMode: (m: "srs" | "practice") => void }) {
  return (
    <div className="p-4 w-full flex justify-center pb-2">
      <div className="bg-surface border border-line rounded-full p-1 flex gap-1 shadow-sm w-full max-w-xs relative">
        <button
          onClick={() => setMode("srs")}
          className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-full transition-colors z-10 ${
            mode === "srs" ? "text-ink" : "text-ink-soft hover:text-ink"
          }`}
        >
          Flashcards
        </button>
        <button
          onClick={() => setMode("practice")}
          className={`flex-1 py-2.5 px-4 text-sm font-medium rounded-full transition-colors z-10 ${
            mode === "practice" ? "text-ink" : "text-ink-soft hover:text-ink"
          }`}
        >
          Practice
        </button>
        
        {/* Sliding Indicator */}
        <div 
          className="absolute top-1 bottom-1 left-1 w-[calc(50%-6px)] bg-paper rounded-full shadow-sm border border-line z-0 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]"
          style={{ transform: `translateX(${mode === "srs" ? "0%" : "calc(100% + 4px)"})` }}
        />
      </div>
    </div>
  );
}
