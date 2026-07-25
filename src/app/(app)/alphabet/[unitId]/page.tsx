"use client";

import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, Check } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ExercisePlayer } from "@/components/alphabet/exercise-player";
import { LetterCard } from "@/components/alphabet/letter-card";
import { NotificationPrompt } from "@/components/notification-prompt";
import { Button } from "@/components/ui/button";
import { alphabetCourse } from "@/lib/content/load";
import { completeAlphabetUnit } from "@/lib/db/alphabet";
import { XP, recordActivity } from "@/lib/gamification";
import { useAlphabetProgress, useGrammarProgress, useInvalidateLearning, useSupabase, useUser } from "@/lib/queries/hooks";

type Phase = { kind: "letters"; index: number } | { kind: "exercises" } | { kind: "done"; correct: number; total: number };

export default function AlphabetUnitPage() {
  const { unitId } = useParams<{ unitId: string }>();
  const router = useRouter();
  const db = useSupabase();
  const { data: user } = useUser();
  const invalidate = useInvalidateLearning();

  const unit = alphabetCourse.units.find((u) => u.id === unitId);
  const [phase, setPhase] = useState<Phase>({ kind: "letters", index: 0 });
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  const { data: alphaProgress } = useAlphabetProgress();
  const { data: grammarProgress } = useGrammarProgress();

  const totalCompleted = 
    (alphaProgress?.filter((u) => u.completed_at)?.length ?? 0) + 
    (grammarProgress?.filter((l) => l.completed_at)?.length ?? 0);

  useEffect(() => {
    if (phase.kind === "done" && totalCompleted === 1 && !localStorage.getItem("hasSeenNotifPrompt")) {
      queueMicrotask(() => setShowNotifPrompt(true));
      localStorage.setItem("hasSeenNotifPrompt", "true");
    }
  }, [phase.kind, totalCompleted]);

  const complete = useMutation({
    mutationFn: async ({ correct, total }: { correct: number; total: number }) => {
      if (!user || !unit) return;
      const letters = unit.letters.map(l => l.char);
      await completeAlphabetUnit(db, user.id, unitId, correct, total, letters);
      await recordActivity(db, user.id, { xp: XP.alphabetUnit });
    },
    onSuccess: () => invalidate(),
  });

  if (!unit) {
    return <p className="py-20 text-center text-ink-soft">Unit not found.</p>;
  }

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <div className="mb-4 flex items-center gap-3">
        <Link
          href="/alphabet"
          className="flex size-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-ink"
          aria-label="Back to alphabet"
        >
          <ArrowLeft size={19} />
        </Link>
        <div>
          <p className="text-[15px] font-semibold leading-tight">{unit.title}</p>
          <p className="text-[12px] text-ink-faint">
            {phase.kind === "letters"
              ? `Letter ${phase.index + 1} of ${unit.letters.length}`
              : phase.kind === "exercises"
                ? "Practice"
                : "Complete"}
          </p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {phase.kind === "letters" && (
          <motion.div
            key={`letter-${phase.index}`}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="flex flex-1 flex-col"
          >
            <div className="my-auto py-4">
              <LetterCard letter={unit.letters[phase.index]} />
            </div>
            <div className="pb-6">
              <Button
                size="lg"
                className="w-full"
                onClick={() =>
                  phase.index + 1 < unit.letters.length
                    ? setPhase({ kind: "letters", index: phase.index + 1 })
                    : setPhase({ kind: "exercises" })
                }
              >
                {phase.index + 1 < unit.letters.length ? "Next letter" : "Practice"}
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
            <ExercisePlayer
              unit={unit}
              onComplete={(correct, total) => {
                complete.mutate({ correct, total });
                setPhase({ kind: "done", correct, total });
              }}
            />
          </motion.div>
        )}

        {phase.kind === "done" && (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-1 flex-col items-center justify-center text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 22, delay: 0.1 }}
              className="flex size-16 items-center justify-center rounded-full bg-sabz-soft text-sabz"
            >
              <Check size={30} strokeWidth={2.5} />
            </motion.div>
            <h2 className="mt-6 text-[22px] font-semibold tracking-tight">{unit.title} complete</h2>
            <p className="mt-2 text-[15px] text-ink-soft">
              {phase.correct} of {phase.total} first try · +{XP.alphabetUnit} XP
            </p>
            <div dir="rtl" className="mt-6 flex flex-wrap justify-center gap-2">
              {unit.letters.map((l) => (
                <span key={l.char} lang="prs" className="rounded-full bg-lapis-soft px-3.5 py-1 text-[22px] text-lapis">
                  {l.char}
                </span>
              ))}
            </div>
            <Button
              size="lg"
              className="mt-10"
              onClick={() => {
                router.push("/alphabet");
                router.refresh();
              }}
            >
              Continue
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
      <NotificationPrompt isOpen={showNotifPrompt} onClose={() => setShowNotifPrompt(false)} />
    </div>
  );
}
