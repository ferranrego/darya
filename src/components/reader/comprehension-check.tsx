"use client";

import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { questionDisplay, scoreQuiz, type QuizResult } from "@/lib/content/comprehension";
import type { ComprehensionQuestion } from "@/lib/content/schema";
import { profile as langProfile } from "@/lib/lang";
import { hapticSuccess, hapticTap } from "@/lib/util/haptics";

/**
 * The comprehension check shown after a text.
 *
 * Deliberately cannot withhold anything. The points and the level credit for
 * finishing a text are already awarded by the time this appears, and the score
 * is recorded rather than spent - punishing a first attempt is the fastest way
 * to make people stop finishing texts, and reading is the app's whole method.
 * What the score is for is promotion, later, where "has read forty texts" and
 * "has understood forty texts" stop being the same claim.
 *
 * A wrong answer shows the sentence that proves the right one. Being told only
 * "no" teaches nothing; being shown the line is the cheapest correction the
 * app can make, and it is already written.
 */
export function ComprehensionCheck({
  questions,
  level,
  onDone,
}: {
  questions: ComprehensionQuestion[];
  /** Decides whether the question is shown in both languages or Dari alone. */
  level: string;
  onDone: (result: QuizResult) => void;
}) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null));
  const [chosen, setChosen] = useState<number | null>(null);

  const q = questions[index];
  const display = questionDisplay(level);
  const answered = chosen !== null;
  const isRight = chosen === q.answerIndex;

  function choose(i: number) {
    if (answered) return;
    setChosen(i);
    const next = [...answers];
    next[index] = i;
    setAnswers(next);
    if (i === q.answerIndex) hapticSuccess();
    else hapticTap();
  }

  function advance() {
    if (index + 1 >= questions.length) {
      onDone(scoreQuiz(questions, answers));
      return;
    }
    setIndex(index + 1);
    setChosen(null);
  }

  return (
    <div className="flex min-h-[70vh] flex-col gap-6 p-6">
      <div className="flex items-center gap-2">
        {questions.map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${
              i < index ? "bg-sabz" : i === index ? "bg-lapis" : "bg-line"
            }`}
          />
        ))}
      </div>

      <header className="flex flex-col gap-2">
        <p className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
          Did you follow it?
        </p>
        {display.target ? (
          <p lang={langProfile.code} dir="rtl" className="text-[22px] leading-snug text-ink">
            {q.questionTarget}
          </p>
        ) : null}
        {display.target && q.questionTranslit ? (
          <p className="text-[13px] font-medium text-ink-soft">{q.questionTranslit}</p>
        ) : null}
        {display.en ? (
          <p className="text-[17px] font-semibold leading-snug text-ink">{q.questionEn}</p>
        ) : null}
      </header>

      <div className="flex flex-col gap-3">
        {q.options.map((option, i) => {
          const isAnswer = i === q.answerIndex;
          const isChosen = i === chosen;
          return (
            <button
              key={i}
              type="button"
              onClick={() => choose(i)}
              disabled={answered}
              className={`flex items-start justify-between gap-3 rounded-2xl border p-4 text-right transition-all duration-200 ${
                answered && isAnswer
                  ? "border-sabz bg-sabz-soft/40"
                  : answered && isChosen
                    ? "border-danger bg-danger/10"
                    : "border-line bg-surface hover:border-lapis"
              } ${answered ? "" : "active:scale-[0.99]"}`}
            >
              <span className="flex flex-col gap-1 flex-1">
                <span lang={langProfile.code} dir="rtl" className="text-[19px] leading-snug text-ink">
                  {option.target}
                </span>
                {option.translit ? (
                  <span dir="ltr" className="text-[12px] text-ink-soft text-left">
                    {option.translit}
                  </span>
                ) : null}
              </span>
              {answered && isAnswer ? <Check size={20} className="text-sabz shrink-0" /> : null}
              {answered && isChosen && !isAnswer ? <X size={20} className="text-danger shrink-0" /> : null}
            </button>
          );
        })}
      </div>

      {answered ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          <p className="text-[15px] font-semibold text-ink">
            {isRight ? "That's it." : "Not quite - it was this one:"}
          </p>
          {!isRight ? (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <p lang={langProfile.code} dir="rtl" className="text-[19px] leading-snug text-ink">
                {q.options[q.answerIndex].target}
              </p>
              <p className="mt-1 text-[14px] text-ink-soft">{q.options[q.answerIndex].en}</p>
            </div>
          ) : null}
          <Button size="lg" onClick={advance}>
            {index + 1 >= questions.length ? "Done" : "Next"}
          </Button>
        </motion.div>
      ) : null}
    </div>
  );
}
