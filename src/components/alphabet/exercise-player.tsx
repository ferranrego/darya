"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { AlphabetUnit, Exercise, Letter } from "@/lib/content/schema";

/** Deterministic shuffle so options don't reshuffle on re-render. */
function shuffled<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    const j = Math.abs(h) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type Feedback = "idle" | "correct" | "wrong";

export function ExercisePlayer({
  unit,
  onComplete,
}: {
  unit: AlphabetUnit;
  onComplete: (correct: number, total: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [firstTryHits, setFirstTryHits] = useState(0);
  const [missedThis, setMissedThis] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>("idle");

  const letterByChar = useMemo(() => {
    const m = new Map<string, Letter>();
    for (const l of unit.letters) m.set(l.char, l);
    return m;
  }, [unit]);

  const exercise = unit.exercises[index];
  const total = unit.exercises.length;

  function advance(wasCorrectFirstTry: boolean) {
    if (wasCorrectFirstTry) setFirstTryHits((n) => n + 1);
    setFeedback("idle");
    setMissedThis(false);
    if (index + 1 >= total) {
      onComplete(firstTryHits + (wasCorrectFirstTry ? 1 : 0), total);
    } else {
      setIndex((i) => i + 1);
    }
  }

  function handleAnswer(correct: boolean) {
    if (feedback === "correct") return;
    if (correct) {
      setFeedback("correct");
      const first = !missedThis;
      setTimeout(() => advance(first), 650);
    } else {
      setFeedback("wrong");
      setMissedThis(true);
      setTimeout(() => setFeedback((f) => (f === "wrong" ? "idle" : f)), 450);
    }
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/70">
          <div
            className="h-full rounded-full bg-lapis transition-all duration-300"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
        <span className="text-[13px] tabular-nums text-ink-faint">
          {index + 1}/{total}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={exercise.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="flex flex-1 flex-col"
        >
          <ExerciseView
            exercise={exercise}
            letterByChar={letterByChar}
            feedback={feedback}
            onAnswer={handleAnswer}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ExerciseView({
  exercise,
  letterByChar,
  feedback,
  onAnswer,
}: {
  exercise: Exercise;
  letterByChar: Map<string, Letter>;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
}) {
  switch (exercise.type) {
    case "recognizeLetter": {
      const letter = letterByChar.get(exercise.targetChar);
      return (
        <ChoiceGrid
          prompt={
            <>
              Which one is <strong>{letter?.name ?? exercise.targetChar}</strong>
              {letter ? <span className="text-ink-soft"> ({letter.sound})</span> : null}?
            </>
          }
          hint={exercise.hint}
          options={shuffled([exercise.targetChar, ...exercise.distractors], exercise.id)}
          isCorrect={(o) => o === exercise.targetChar}
          feedback={feedback}
          onAnswer={onAnswer}
          big
        />
      );
    }
    case "matchSound":
      return (
        <ChoiceGrid
          prompt={
            <>
              Which letter makes the sound <strong>{exercise.sound}</strong>?
            </>
          }
          hint={exercise.hint}
          options={shuffled([exercise.targetChar, ...exercise.distractors], exercise.id)}
          isCorrect={(o) => o === exercise.targetChar}
          feedback={feedback}
          onAnswer={onAnswer}
          big
        />
      );
    case "pickForm": {
      const letter = letterByChar.get(exercise.targetChar);
      const chars = [...exercise.word];
      return (
        <div className="flex flex-1 flex-col">
          <Prompt hint={exercise.hint}>
            Tap the letter <strong>{letter?.name ?? exercise.targetChar}</strong>{" "}
            <span lang="prs" className="text-[20px]">
              ({exercise.targetChar})
            </span>{" "}
            in this word
          </Prompt>
          <div className="my-auto py-10 text-center">
            <div dir="rtl" className="inline-flex">
              {chars.map((ch, i) => (
                <FeedbackButton
                  key={i}
                  correct={ch === exercise.targetChar}
                  feedback={feedback}
                  onAnswer={onAnswer}
                  className="px-1 py-2 text-[56px]"
                  lang="prs"
                >
                  {ch}
                </FeedbackButton>
              ))}
            </div>
            <p className="mt-4 text-[14px] text-ink-soft">
              {exercise.translit} · {exercise.glossEn}
            </p>
          </div>
        </div>
      );
    }
    case "readWord":
      return (
        <div className="flex flex-1 flex-col">
          <Prompt hint={exercise.hint}>How does this word read?</Prompt>
          <div className="my-auto py-8 text-center">
            <p lang="prs" className="text-[64px] leading-tight">
              {exercise.word}
            </p>
            <p className="mt-2 text-[14px] text-ink-faint">{exercise.glossEn}</p>
            <div className="mx-auto mt-10 flex max-w-sm flex-col gap-3">
              {shuffled(exercise.choices, exercise.id).map((choice) => (
                <FeedbackButton
                  key={choice}
                  correct={choice === exercise.translit}
                  feedback={feedback}
                  onAnswer={onAnswer}
                  className="h-12 rounded-xl border border-line bg-surface text-[17px] font-medium hover:border-ink-faint"
                >
                  {choice}
                </FeedbackButton>
              ))}
            </div>
          </div>
        </div>
      );
    case "readSentence":
      return <ReadSentence key={exercise.id} exercise={exercise} onAnswer={onAnswer} />;
  }
}

function ReadSentence({
  exercise,
  onAnswer,
}: {
  exercise: Extract<Exercise, { type: "readSentence" }>;
  onAnswer: (correct: boolean) => void;
}) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex flex-1 flex-col">
      <Prompt hint={exercise.hint}>Read this sentence out loud</Prompt>
      <div className="my-auto py-8 text-center">
        <p lang="prs" className="text-[38px] leading-[1.9]">
          {exercise.dari}
        </p>
        {checked && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <p className="text-[16px] text-ink-soft">{exercise.translit}</p>
            <p className="mt-1 text-[15px] text-ink-faint">{exercise.en}</p>
          </motion.div>
        )}
        <div className="mt-10">
          {checked ? (
            <Button size="lg" onClick={() => onAnswer(true)}>
              Continue
            </Button>
          ) : (
            <Button size="lg" variant="secondary" onClick={() => setChecked(true)}>
              Check my reading
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Prompt({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <h2 className="text-[20px] font-semibold leading-snug tracking-tight">{children}</h2>
      {hint && <p className="mt-1.5 text-[13px] text-ink-soft">{hint}</p>}
    </div>
  );
}

function ChoiceGrid({
  prompt,
  hint,
  options,
  isCorrect,
  feedback,
  onAnswer,
  big,
}: {
  prompt: React.ReactNode;
  hint?: string;
  options: string[];
  isCorrect: (option: string) => boolean;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
  big?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <Prompt hint={hint}>{prompt}</Prompt>
      <div className="my-auto grid grid-cols-2 gap-3 py-10">
        {options.map((option) => (
          <FeedbackButton
            key={option}
            correct={isCorrect(option)}
            feedback={feedback}
            onAnswer={onAnswer}
            lang="prs"
            className={`rounded-2xl border border-line bg-surface py-6 ${big ? "text-[48px]" : "text-[28px]"} hover:border-ink-faint`}
          >
            {option}
          </FeedbackButton>
        ))}
      </div>
    </div>
  );
}

/**
 * Answer button with built-in result styling: correct answers flash sabz,
 * wrong taps shake and flash danger, per DESIGN.md motion specs.
 */
function FeedbackButton({
  correct,
  feedback,
  onAnswer,
  className = "",
  lang,
  children,
}: {
  correct: boolean;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
  className?: string;
  lang?: string;
  children: React.ReactNode;
}) {
  const [picked, setPicked] = useState(false);
  const showCorrect = feedback === "correct" && correct && picked;
  const showWrong = feedback === "wrong" && picked && !correct;
  if (feedback === "idle" && picked) setPicked(false);

  return (
    <motion.button
      type="button"
      lang={lang}
      animate={showWrong ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      onClick={() => {
        setPicked(true);
        onAnswer(correct);
      }}
      className={`transition-colors duration-200 ${className} ${
        showCorrect
          ? "!border-sabz !bg-sabz-soft text-sabz"
          : showWrong
            ? "!border-danger text-danger"
            : ""
      }`}
    >
      {children}
    </motion.button>
  );
}
