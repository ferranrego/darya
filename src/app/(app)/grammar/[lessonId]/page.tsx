"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { GrammarExercisePlayer } from "@/components/grammar/exercise-player";
import { SlideCard } from "@/components/grammar/slide-card";
import { NotificationPrompt } from "@/components/notification-prompt";
import { Poncha } from "@/components/poncha";
import { Button } from "@/components/ui/button";
import { grammarLessonById, grammarLessons } from "@/lib/content/load";
import type { GrammarExercise } from "@/lib/content/schema";
import { completeGrammarLesson } from "@/lib/db/grammar";
import { XP, recordActivity } from "@/lib/gamification";
import { useAlphabetProgress, useGrammarProgress, useInvalidateLearning, useSupabase, useUser } from "@/lib/queries/hooks";

type Phase =
  | { kind: "slides"; index: number }
  | { kind: "exercises" }
  | { kind: "done"; correct: number; total: number }
  | { kind: "practice"; exercises: GrammarExercise[] }
  | { kind: "practiceDone"; correct: number; total: number; xp: number };

interface PracticeItem {
  id: number;
  exercise: GrammarExercise;
}

export default function GrammarLessonPage() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const router = useRouter();
  const db = useSupabase();
  const { data: user } = useUser();
  const invalidate = useInvalidateLearning();

  const lesson = grammarLessonById(lessonId);
  const [phase, setPhase] = useState<Phase>({ kind: "slides", index: 0 });
  const [practiceError, setPracticeError] = useState(false);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  const { data: alphaProgress } = useAlphabetProgress();
  const { data: grammarProgress } = useGrammarProgress();

  // Practice items already played this session, so "Practice more" again
  // brings fresh ones from the shared pool.
  const seenPracticeIds = useRef<number[]>([]);

  const totalCompleted = 
    (alphaProgress?.filter((u) => u.completed_at)?.length ?? 0) + 
    (grammarProgress?.filter((l) => l.completed_at)?.length ?? 0);

  useEffect(() => {
    if (phase.kind === "done" && totalCompleted === 1 && !localStorage.getItem("hasSeenNotifPrompt")) {
      setShowNotifPrompt(true);
      localStorage.setItem("hasSeenNotifPrompt", "true");
    }
  }, [phase.kind, totalCompleted]);

  const complete = useMutation({
    mutationFn: async ({ correct, total }: { correct: number; total: number }) => {
      if (!user || !lesson) return;
      await completeGrammarLesson(db, user.id, lessonId, correct, total);
      await recordActivity(db, user.id, { xp: XP.grammarLesson });
    },
    onSuccess: () => invalidate(),
  });

  const practice = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/generate/grammar-practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, excludeIds: seenPracticeIds.current }),
      });
      if (!res.ok) throw new Error(`Practice generation failed (${res.status})`);
      const data = (await res.json()) as { items: PracticeItem[] };
      if (!data.items?.length) throw new Error("No practice items");
      return data.items;
    },
    onSuccess: (items) => {
      seenPracticeIds.current.push(...items.map((i) => i.id));
      setPracticeError(false);
      setPhase({ kind: "practice", exercises: items.map((i) => i.exercise) });
    },
    onError: () => setPracticeError(true),
  });

  const completePractice = useMutation({
    mutationFn: async (total: number) => {
      if (!user) return 0;
      const xp = XP.review * total;
      await recordActivity(db, user.id, { xp });
      return xp;
    },
    onSuccess: () => invalidate(),
  });

  if (!lesson) {
    return <p className="py-20 text-center text-ink-soft">Lesson not found.</p>;
  }

  const lessonNumber = grammarLessons.findIndex((l) => l.id === lesson.id) + 1;
  const keyExample = lesson.slides[0]?.examples[0];

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/grammar"
          className="flex size-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-ink"
          aria-label="Back to grammar"
        >
          <ArrowLeft size={19} />
        </Link>
        <div>
          <p className="text-[15px] font-semibold leading-tight">
            {lessonNumber}. {lesson.title}
          </p>
          <p className="text-[12px] text-ink-faint">
            {phase.kind === "slides"
              ? `Step ${phase.index + 1} of ${lesson.slides.length}`
              : phase.kind === "exercises"
                ? "Practice"
                : phase.kind === "practice"
                  ? "Extra practice"
                  : "Complete"}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase.kind === "slides" && (
          <motion.div
            key={`slide-${phase.index}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex flex-1 flex-col"
          >
            <div className="my-auto py-4">
              <SlideCard slide={lesson.slides[phase.index]} />
            </div>
            <div className="pb-6">
              <Button
                size="lg"
                className="w-full"
                onClick={() =>
                  phase.index + 1 < lesson.slides.length
                    ? setPhase({ kind: "slides", index: phase.index + 1 })
                    : setPhase({ kind: "exercises" })
                }
              >
                {phase.index + 1 < lesson.slides.length ? "Next" : "Practice"}
              </Button>
            </div>
          </motion.div>
        )}

        {phase.kind === "exercises" && (
          <motion.div
            key="exercises"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col"
          >
            <GrammarExercisePlayer
              exercises={lesson.exercises}
              onComplete={(correct, total) => {
                complete.mutate({ correct, total });
                setPhase({ kind: "done", correct, total });
              }}
            />
          </motion.div>
        )}

        {phase.kind === "practice" && (
          <motion.div
            key="practice"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-1 flex-col"
          >
            <GrammarExercisePlayer
              exercises={phase.exercises}
              onComplete={(correct, total) => {
                completePractice
                  .mutateAsync(total)
                  .then((xp) => setPhase({ kind: "practiceDone", correct, total, xp: xp ?? 0 }));
              }}
            />
          </motion.div>
        )}

        {(phase.kind === "done" || phase.kind === "practiceDone") && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 flex-col items-center justify-center text-center"
          >
            <Poncha pose="celebrate" size={140} />
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.1 }}
              className="mt-4 flex size-14 items-center justify-center rounded-full bg-sabz-soft text-sabz"
            >
              <Check size={26} strokeWidth={2.5} />
            </motion.div>
            <h2 className="mt-5 text-[22px] font-semibold tracking-tight">
              {phase.kind === "done" ? `${lesson.title} complete` : "Extra practice complete"}
            </h2>
            <p className="mt-2 text-[15px] text-ink-soft">
              {phase.correct} of {phase.total} first try · +
              {phase.kind === "done" ? XP.grammarLesson : phase.xp} XP
            </p>

            {phase.kind === "done" && keyExample && (
              <p
                lang="prs"
                dir="rtl"
                className="mt-6 rounded-full bg-lapis-soft px-5 py-2 text-[20px] text-lapis"
              >
                {keyExample.dari}
              </p>
            )}

            <div className="mt-10 flex flex-col items-center gap-3">
              <Button
                size="lg"
                onClick={() => {
                  router.push("/grammar");
                  router.refresh();
                }}
              >
                Continue
              </Button>
              <Button
                size="lg"
                variant="secondary"
                disabled={practice.isPending}
                onClick={() => practice.mutate()}
              >
                <Sparkles size={17} />
                {practice.isPending ? "Fetching fresh practice…" : "Practice more"}
              </Button>
              {practiceError && (
                <p className="text-[13px] text-ink-faint">
                  Practice isn&apos;t available right now — try again later.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <NotificationPrompt isOpen={showNotifPrompt} onClose={() => setShowNotifPrompt(false)} />
    </div>
  );
}
