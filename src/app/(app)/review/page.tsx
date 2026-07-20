"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, RotateCcw, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { lexemeById } from "@/lib/content/load";
import { logReview, upsertUserWord } from "@/lib/db/words";
import type { UserWordRow } from "@/lib/db/types";
import { XP, recordActivity } from "@/lib/gamification";
import { useInvalidateLearning, useSupabase, useUser, useUserWords } from "@/lib/queries/hooks";
import { isGraduated, reviewCard, reviveCard, type TwoButtonGrade } from "@/lib/srs/scheduler";

const SESSION_CAP = 40;

export default function ReviewPage() {
  const db = useSupabase();
  const { data: user } = useUser();
  const { data: words, isLoading } = useUserWords();
  const invalidate = useInvalidateLearning();

  // Snapshot the queue once per session so grading doesn't reshuffle it.
  const [queue, setQueue] = useState<UserWordRow[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [graduatedNow, setGraduatedNow] = useState<string[]>([]);
  const [exitDir, setExitDir] = useState<1 | -1>(1);

  const due = useMemo(() => {
    if (!words) return null;
    const now = Date.now();
    return words
      .filter((w) => w.status === "learning" && w.due && new Date(w.due).getTime() <= now && w.fsrs)
      .sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime())
      .slice(0, SESSION_CAP);
  }, [words]);

  if (queue === null && due !== null) {
    setQueue(due);
  }

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
      if (result?.graduated) setGraduatedNow((g) => [...g, result.entryId]);
    },
  });

  function answer(g: TwoButtonGrade) {
    if (!queue) return;
    setExitDir(g === "got_it" ? 1 : -1);
    grade.mutate({ row: queue[index], g });
    setRevealed(false);
    setIndex((i) => i + 1);
  }

  if (isLoading || queue === null) {
    return <div className="flex flex-1 items-center justify-center py-32 text-ink-faint">Loading…</div>;
  }

  if (queue.length === 0) {
    return (
      <EmptyState
        icon={<Check size={24} />}
        title="All caught up"
        body="No words are due right now. Read something new — tapped words will show up here."
      />
    );
  }

  if (index >= queue.length) {
    return <SessionDone total={queue.length} graduated={graduatedNow} onExit={() => invalidate()} />;
  }

  const row = queue[index];
  const entry = lexemeById(row.lexeme_id);
  if (!entry) {
    return <EmptyState icon={<RotateCcw size={24} />} title="Hmm" body="A reviewed word is missing from the dictionary." />;
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-6 flex items-center gap-3 pt-2">
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
        <AnimatePresence mode="wait">
          <motion.div
            key={`${row.lexeme_id}-${index}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: exitDir * 60, transition: { duration: 0.2 } }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="w-full max-w-md rounded-3xl border border-line bg-surface px-8 py-12 text-center shadow-[0_2px_20px_rgba(31,26,23,0.05)]"
          >
            <p lang="prs" className="text-[52px] leading-snug">
              {entry.dari}
            </p>
            <AnimatePresence mode="wait">
              {revealed ? (
                <motion.div
                  key="answer"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="mt-4"
                >
                  <p className="text-[16px] text-ink-soft">{entry.translit}</p>
                  <p className="mt-2 text-[22px] font-medium">{entry.glossEn}</p>
                  <div className="mt-6 rounded-2xl bg-paper px-4 py-3">
                    <p lang="prs" className="text-[18px] leading-loose">
                      {entry.exampleDari}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-faint">{entry.exampleEn}</p>
                  </div>
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
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="pb-6 pt-8">
        {revealed ? (
          <div className="mx-auto flex max-w-md gap-3">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => answer("forgot")}>
              Forgot
            </Button>
            <Button size="lg" className="flex-1" onClick={() => answer("got_it")}>
              Got it
            </Button>
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
  );
}

function SessionDone({
  total,
  graduated,
  onExit,
}: {
  total: number;
  graduated: string[];
  onExit: () => void;
}) {
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
      <p className="mt-2 text-[15px] text-ink-soft">
        {total} review{total === 1 ? "" : "s"}
        {graduated.length > 0 && (
          <>
            {" · "}
            <span className="font-medium text-sabz">
              {graduated.length} word{graduated.length === 1 ? "" : "s"} now known
            </span>
          </>
        )}
      </p>
      {graduated.length > 0 && (
        <div className="mt-6 flex max-w-sm flex-wrap justify-center gap-2">
          {graduated.map((id) => {
            const e = lexemeById(id);
            return e ? (
              <span key={id} lang="prs" className="rounded-full bg-sabz-soft px-3.5 py-1 text-[18px] text-sabz">
                {e.dari}
              </span>
            ) : null;
          })}
        </div>
      )}
      <Button size="lg" className="mt-10" onClick={onExit}>
        Done
      </Button>
    </motion.div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-32 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-sabz-soft text-sabz">{icon}</div>
      <h2 className="mt-6 text-[20px] font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}
