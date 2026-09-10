"use client";

import { useRef, useState } from "react";
import { logErrors, resolveErrors } from "@/lib/db/errors";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import { ClozeExercise } from "./cloze-exercise";
import { UnscrambleExercise } from "./unscramble-exercise";
import { RealiaExercise } from "./realia-exercise";
import { GrammarDetective } from "./grammar-detective";
import type { ExerciseRow } from "@/lib/db/types";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";
import { useSupabase, useUser } from "@/lib/queries/hooks";
import { useRouter } from "next/navigation";

export function PracticeSession({ onFinish }: { onFinish?: () => void }) {
  const router = useRouter();
  const db = useSupabase();
  const { data: user } = useUser();
  const [index, setIndex] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [queryKey] = useState(() => ["generate_exercises", Date.now().toString()]);

  const { data: exercises = [], isPending, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 25000);
      try {
        const res = await fetch("/api/generate/exercises", { 
          method: "POST",
          signal: controller.signal
        });
        
        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          if (errJson.error === "not_enough_vocab") {
            throw new Error("not_enough_vocab");
          }
          throw new Error("Failed to generate");
        }
        const json = await res.json();
        return json.exercises as ExerciseRow[];
      } finally {
        clearTimeout(timeoutId);
      }
    },
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    staleTime: Infinity,
  });

  // What the learner got wrong on the way to getting it right. Every exercise
  // lets them retry, so `onComplete` always reports success - without this the
  // only thing ever recorded is that they eventually passed.
  const wrongRef = useRef<string[]>([]);

  const recordResult = useMutation({
    mutationFn: async ({
      exId,
      isCorrect,
      lexemeIds,
    }: { exId: string; isCorrect: boolean; lexemeIds: string[] }) => {
      if (!user) return;
      const wrong = wrongRef.current;
      wrongRef.current = [];
      await db.from("user_exercises").insert({
        user_id: user.id,
        exercise_id: exId,
        is_correct: isCorrect && wrong.length === 0,
        chosen_answer: wrong[0] ?? null,
        attempt: wrong.length + 1,
      });
      // The word the exercise was about has to travel with the mistake. A row
      // carrying only the exercise id records that something went wrong and
      // nothing that can be re-taught - the whole point is that practice can
      // lead with the words this learner keeps losing.
      const lexemeId = lexemeIds[0] ?? null;
      await logErrors(
        db,
        user.id,
        wrong.map((given) => ({ kind: "exercise" as const, itemId: exId, lexemeId, given })),
      );
      // Right first time closes the open mistakes about this word. Resolving
      // rather than deleting keeps "got this wrong four times before it stuck",
      // which is the shape any later report needs.
      if (isCorrect && wrong.length === 0 && lexemeId) {
        await resolveErrors(db, user.id, lexemeId);
      }
    }
  });

  // Show loader while generating, or if we just haven't started rendering them yet
  if ((isPending || (!isError && exercises.length === 0)) && !isDone) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center p-4">
        <Loader2 className="animate-spin text-ink-faint mb-4" size={32} />
        <p className="text-ink-soft animate-pulse">Generating your custom exercises...</p>
      </div>
    );
  }

  if (isError && exercises.length === 0) {
    const isVocabError = error?.message === "not_enough_vocab";

    return (
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
        {isVocabError ? (
          <>
            <div className="flex size-16 items-center justify-center rounded-full bg-lapis-soft text-lapis mb-6">
              <Sparkles size={28} />
            </div>
            <h2 className="text-xl font-semibold mb-2">Keep Learning!</h2>
            <p className="text-ink-soft mb-8">You need to learn a few more words before you can unlock practice sentences.</p>
            <Button onClick={() => router.push("/")}>Return Home</Button>
          </>
        ) : (
          <>
            <p className="text-rose mb-4">Failed to generate exercises.</p>
            <Button onClick={() => refetch()}>Try Again</Button>
          </>
        )}
      </div>
    );
  }

  if (isDone) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-1 flex-col items-center justify-center py-24 text-center"
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-sabz-soft text-sabz mb-6">
          <Sparkles size={28} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Practice Complete!</h2>
        <p className="text-ink-soft mt-2 mb-8">You&apos;re making great progress.</p>
        <Button size="lg" onClick={() => (onFinish ? onFinish() : router.push("/"))}>Return Home</Button>
      </motion.div>
    );
  }

  if (index >= exercises.length) {
    return null; // Will immediately transition to isDone in next render pass conceptually
  }

  const ex = exercises[index];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = ex.data as any;

  const handleComplete = (isCorrect: boolean) => {
    recordResult.mutate({ exId: ex.id, isCorrect, lexemeIds: ex.lexeme_ids ?? [] });
    if (index + 1 >= exercises.length) {
      setIsDone(true);
    } else {
      setIndex(i => i + 1);
    }
  };

  return (
    <div className="flex flex-1 flex-col h-full w-full relative">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-line/70">
        <div 
          className="h-full bg-lapis transition-all duration-300"
          style={{ width: `${(index / exercises.length) * 100}%` }}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={ex.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="flex-1 flex"
        >
          {ex.type === "cloze" && (
            <ClozeExercise
              {...data}
              onWrong={(chosen) => wrongRef.current.push(chosen)}
              onComplete={handleComplete}
            />
          )}
          {ex.type === "unscramble" && (
            <UnscrambleExercise
              {...data}
              onWrong={(chosen) => wrongRef.current.push(chosen)}
              onComplete={handleComplete}
            />
          )}
          {ex.type === "realia" && (
            <RealiaExercise
              {...data}
              onWrong={(chosen) => wrongRef.current.push(chosen)}
              onComplete={handleComplete}
            />
          )}
          {ex.type === "grammar_detective" && (
            <GrammarDetective
              {...data}
              onWrong={(chosen) => wrongRef.current.push(chosen)}
              onComplete={handleComplete}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
