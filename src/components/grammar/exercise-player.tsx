"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { GrammarExercise, GrammarOption } from "@/lib/content/schema";
import { normalizeDari } from "@/lib/text/normalize";

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

export function GrammarExercisePlayer({
  exercises,
  onComplete,
}: {
  exercises: GrammarExercise[];
  onComplete: (correct: number, total: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [firstTryHits, setFirstTryHits] = useState(0);
  const [missedThis, setMissedThis] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>("idle");

  const exercise = exercises[index];
  const total = exercises.length;

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
      setTimeout(() => advance(first), 900);
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
          <ExerciseView exercise={exercise} feedback={feedback} onAnswer={handleAnswer} />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function ExerciseView({
  exercise,
  feedback,
  onAnswer,
}: {
  exercise: GrammarExercise;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
}) {
  switch (exercise.type) {
    case "fillBlank":
      return <FillBlank key={exercise.id} exercise={exercise} feedback={feedback} onAnswer={onAnswer} />;
    case "buildSentence":
      return <BuildSentence key={exercise.id} exercise={exercise} feedback={feedback} onAnswer={onAnswer} />;
    case "chooseTranslation":
      return <ChooseTranslation key={exercise.id} exercise={exercise} feedback={feedback} onAnswer={onAnswer} />;
    case "matchPairs":
      return <MatchPairs key={exercise.id} exercise={exercise} onAnswer={onAnswer} />;
    case "spotError":
      return <SpotError key={exercise.id} exercise={exercise} feedback={feedback} onAnswer={onAnswer} />;
  }
}

// ---------------------------------------------------------------------------
// fillBlank
// ---------------------------------------------------------------------------

function FillBlank({
  exercise,
  feedback,
  onAnswer,
}: {
  exercise: Extract<GrammarExercise, { type: "fillBlank" }>;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
}) {
  const filled = feedback === "correct";
  // Split around the placeholder; never render the underscores themselves,
  // raw "___" inside RTL text triggers bidi reordering glitches.
  const [dariBefore, dariAfter] = exercise.dari.split("___");
  const [translitBefore, translitAfter] = exercise.translit.split("___");
  const options = useMemo(
    () => shuffled([exercise.answer, ...exercise.distractors], exercise.id),
    [exercise],
  );

  return (
    <div className="flex flex-1 flex-col">
      <Prompt hint={exercise.hint}>Complete the sentence</Prompt>
      <div className="my-auto py-6 text-center">
        <p lang="prs" dir="rtl" className="text-[30px] leading-[2]">
          {dariBefore}
          <span
            className={`mx-1 inline-flex min-w-16 items-center justify-center rounded-xl border-2 px-2 align-middle transition-colors duration-200 ${
              filled ? "border-sabz bg-sabz-soft text-sabz" : "border-dashed border-line text-transparent"
            }`}
          >
            {filled ? (
              <motion.span initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                {exercise.answer.dari}
              </motion.span>
            ) : (
              "-"
            )}
          </span>
          {dariAfter}
        </p>
        <p className="mt-2 text-[15px] text-ink-soft">
          {translitBefore}
          <span className={filled ? "font-medium text-sabz" : "text-ink-faint"}>
            {filled ? exercise.answer.translit : "…"}
          </span>
          {translitAfter}
        </p>
        <p className="mt-1 text-[14px] text-ink-faint">{exercise.en}</p>

        <div className="mx-auto mt-10 grid max-w-sm grid-cols-2 gap-3">
          {options.map((option) => (
            <FeedbackButton
              key={option.dari}
              correct={normalizeDari(option.dari) === normalizeDari(exercise.answer.dari)}
              feedback={feedback}
              onAnswer={onAnswer}
              className="rounded-2xl border border-line bg-surface px-3 py-4 hover:border-ink-faint"
            >
              <span lang="prs" className="block text-[24px] leading-snug">
                {option.dari}
              </span>
              <span className="mt-0.5 block text-[12px] text-ink-faint">{option.translit}</span>
            </FeedbackButton>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// buildSentence
// ---------------------------------------------------------------------------

interface Tile {
  key: string;
  option: GrammarOption;
}

function BuildSentence({
  exercise,
  feedback,
  onAnswer,
}: {
  exercise: Extract<GrammarExercise, { type: "buildSentence" }>;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
}) {
  const bank = useMemo<Tile[]>(
    () =>
      shuffled(
        [...exercise.words, ...exercise.extraWords].map((option, i) => ({ key: `${i}`, option })),
        exercise.id,
      ),
    [exercise],
  );
  const [placedKeys, setPlacedKeys] = useState<string[]>([]);
  const done = feedback === "correct";

  const placed = placedKeys
    .map((k) => bank.find((t) => t.key === k))
    .filter((t): t is Tile => !!t);

  function check() {
    // Compare the logical tap sequence against `words` by index, or any of the
    // `altOrders` alternates. Visual order is RTL but the arrays are in logical
    // (first spoken word first) order.
    const seq = placed.map((tile) => normalizeDari(tile.option.dari));
    const matches = (order: string[]) =>
      order.length === seq.length && order.every((w, i) => normalizeDari(w) === seq[i]);
    const ok =
      matches(exercise.words.map((w) => w.dari)) || exercise.altOrders.some(matches);
    onAnswer(ok);
  }

  return (
    <div className="flex flex-1 flex-col">
      <Prompt hint={exercise.hint}>Build the sentence</Prompt>
      <div className="my-auto py-6">
        <p className="text-center text-[18px] font-medium">{exercise.en}</p>

        <motion.div
          dir="rtl"
          animate={feedback === "wrong" ? { x: [0, -7, 7, -4, 4, 0] } : { x: 0 }}
          transition={{ duration: 0.4 }}
          className={`mx-auto mt-8 flex min-h-16 max-w-md flex-wrap items-center justify-center gap-2 rounded-2xl border-2 px-3 py-3 transition-colors duration-200 ${
            done ? "border-sabz bg-sabz-soft/50" : "border-dashed border-line"
          }`}
        >
          {placed.length === 0 && !done && (
            <span className="text-[13px] text-ink-faint" dir="ltr">
              Tap the words in order
            </span>
          )}
          {placed.map((tile) => (
            <motion.button
              key={tile.key}
              layoutId={`tile-${exercise.id}-${tile.key}`}
              type="button"
              disabled={done}
              onClick={() => setPlacedKeys((ks) => ks.filter((k) => k !== tile.key))}
              className={`rounded-xl border px-3 py-1.5 text-[22px] leading-snug ${
                done ? "border-sabz/40 bg-surface text-sabz" : "border-line bg-surface"
              }`}
              lang="prs"
            >
              {tile.option.dari}
            </motion.button>
          ))}
        </motion.div>

        {done ? (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 text-center text-[15px] font-medium text-sabz"
          >
            {exercise.translit}
          </motion.p>
        ) : (
          <div dir="rtl" className="mx-auto mt-6 flex max-w-md flex-wrap justify-center gap-2">
            {bank
              .filter((tile) => !placedKeys.includes(tile.key))
              .map((tile) => (
                <motion.button
                  key={tile.key}
                  layoutId={`tile-${exercise.id}-${tile.key}`}
                  type="button"
                  onClick={() => setPlacedKeys((ks) => [...ks, tile.key])}
                  className="rounded-xl border border-line bg-surface px-3 py-1.5 transition-colors hover:border-ink-faint"
                >
                  <span lang="prs" className="block text-[22px] leading-snug">
                    {tile.option.dari}
                  </span>
                  <span className="block text-[11px] text-ink-faint" dir="ltr">
                    {tile.option.translit}
                  </span>
                </motion.button>
              ))}
          </div>
        )}

        {!done && (
          <div className="mt-8 text-center">
            <Button size="lg" onClick={check} disabled={placed.length === 0}>
              Check
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// chooseTranslation
// ---------------------------------------------------------------------------

function ChooseTranslation({
  exercise,
  feedback,
  onAnswer,
}: {
  exercise: Extract<GrammarExercise, { type: "chooseTranslation" }>;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
}) {
  if (exercise.direction === "toEn") {
    const options = shuffled([exercise.en, ...exercise.distractorsEn], exercise.id);
    return (
      <div className="flex flex-1 flex-col">
        <Prompt hint={exercise.hint}>What does this mean?</Prompt>
        <div className="my-auto py-6 text-center">
          <p lang="prs" dir="rtl" className="text-[32px] leading-[1.9]">
            {exercise.dari}
          </p>
          <p className="mt-2 text-[15px] text-ink-soft">{exercise.translit}</p>
          <div className="mx-auto mt-10 flex max-w-sm flex-col gap-3">
            {options.map((option) => (
              <FeedbackButton
                key={option}
                correct={option === exercise.en}
                feedback={feedback}
                onAnswer={onAnswer}
                className="min-h-12 rounded-xl border border-line bg-surface px-4 py-3 text-[16px] font-medium hover:border-ink-faint"
              >
                {option}
              </FeedbackButton>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const answer: GrammarOption = { dari: exercise.dari, translit: exercise.translit };
  const options = shuffled([answer, ...exercise.distractorsDari], exercise.id);
  return (
    <div className="flex flex-1 flex-col">
      <Prompt hint={exercise.hint}>How do you say it in Dari?</Prompt>
      <div className="my-auto py-6 text-center">
        <p className="text-[20px] font-medium">{exercise.en}</p>
        <div className="mx-auto mt-10 flex max-w-sm flex-col gap-3">
          {options.map((option) => (
            <FeedbackButton
              key={option.dari}
              correct={normalizeDari(option.dari) === normalizeDari(exercise.dari)}
              feedback={feedback}
              onAnswer={onAnswer}
              className="rounded-xl border border-line bg-surface px-4 py-3 hover:border-ink-faint"
            >
              <span lang="prs" dir="rtl" className="block text-[22px] leading-snug">
                {option.dari}
              </span>
              <span className="mt-0.5 block text-[12px] text-ink-faint">{option.translit}</span>
            </FeedbackButton>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// matchPairs
// ---------------------------------------------------------------------------

function MatchPairs({
  exercise,
  onAnswer,
}: {
  exercise: Extract<GrammarExercise, { type: "matchPairs" }>;
  onAnswer: (correct: boolean) => void;
}) {
  const dariSide = useMemo(
    () => shuffled(exercise.pairs, exercise.id + "-d"),
    [exercise],
  );
  const enSide = useMemo(
    () => shuffled(exercise.pairs, exercise.id + "-e"),
    [exercise],
  );
  const [selectedDari, setSelectedDari] = useState<string | null>(null);
  const [selectedEn, setSelectedEn] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrongPair, setWrongPair] = useState<[string, string] | null>(null);

  function trySelect(dari: string | null, en: string | null) {
    if (dari !== null) setSelectedDari(dari);
    if (en !== null) setSelectedEn(en);
    const d = dari ?? selectedDari;
    const e = en ?? selectedEn;
    if (d === null || e === null) return;

    const pair = exercise.pairs.find((p) => p.dari === d);
    if (pair && pair.en === e) {
      const next = new Set(matched);
      next.add(d);
      setMatched(next);
      setSelectedDari(null);
      setSelectedEn(null);
      if (next.size === exercise.pairs.length) onAnswer(true);
    } else {
      setWrongPair([d, e]);
      onAnswer(false);
      setTimeout(() => {
        setWrongPair(null);
        setSelectedDari(null);
        setSelectedEn(null);
      }, 450);
    }
  }

  const tileClass = (state: "idle" | "selected" | "matched" | "wrong") =>
    `w-full rounded-xl border px-3 py-2.5 transition-colors duration-200 ${
      state === "matched"
        ? "border-sabz/40 bg-sabz-soft text-sabz"
        : state === "selected"
          ? "border-lapis bg-lapis-soft"
          : state === "wrong"
            ? "border-danger text-danger"
            : "border-line bg-surface hover:border-ink-faint"
    }`;

  return (
    <div className="flex flex-1 flex-col">
      <Prompt>{exercise.prompt}</Prompt>
      <div className="my-auto grid grid-cols-2 gap-3 py-8">
        <div className="flex flex-col gap-2.5">
          {enSide.map((p) => {
            const isMatched = matched.has(p.dari);
            const state = isMatched
              ? "matched"
              : wrongPair?.[1] === p.en
                ? "wrong"
                : selectedEn === p.en
                  ? "selected"
                  : "idle";
            return (
              <motion.button
                key={p.en}
                type="button"
                disabled={isMatched}
                animate={state === "wrong" ? { x: [0, -6, 6, -3, 3, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                onClick={() => trySelect(null, p.en)}
                className={`${tileClass(state)} text-[15px] font-medium`}
              >
                {p.en}
              </motion.button>
            );
          })}
        </div>
        <div className="flex flex-col gap-2.5">
          {dariSide.map((p) => {
            const isMatched = matched.has(p.dari);
            const state = isMatched
              ? "matched"
              : wrongPair?.[0] === p.dari
                ? "wrong"
                : selectedDari === p.dari
                  ? "selected"
                  : "idle";
            return (
              <motion.button
                key={p.dari}
                type="button"
                disabled={isMatched}
                animate={state === "wrong" ? { x: [0, -6, 6, -3, 3, 0] } : { x: 0 }}
                transition={{ duration: 0.4 }}
                onClick={() => trySelect(p.dari, null)}
                className={tileClass(state)}
              >
                <span lang="prs" dir="rtl" className="block text-[20px] leading-snug">
                  {p.dari}
                </span>
                <span className="block text-[11px] text-ink-faint">{p.translit}</span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// spotError
// ---------------------------------------------------------------------------

function SpotError({
  exercise,
  feedback,
  onAnswer,
}: {
  exercise: Extract<GrammarExercise, { type: "spotError" }>;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
}) {
  const solved = feedback === "correct";
  const words = exercise.dari.split(/\s+/).filter(Boolean);
  const errorKey = normalizeDari(exercise.errorWord.dari);

  return (
    <div className="flex flex-1 flex-col">
      <Prompt hint={exercise.hint}>Tap the mistake</Prompt>
      <div className="my-auto py-6 text-center">
        <p className="mb-6 text-[15px] text-ink-soft">{exercise.en}</p>
        <div dir="rtl" className="flex flex-wrap items-center justify-center gap-x-1 gap-y-2">
          {words.map((word, i) => {
            const isError = normalizeDari(word) === errorKey;
            if (solved && isError) {
              return (
                <motion.span
                  key={i}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  lang="prs"
                  className="rounded-lg bg-sabz-soft px-2 py-1 text-[26px] leading-snug text-sabz"
                >
                  {exercise.correction.dari}
                </motion.span>
              );
            }
            return (
              <SpotErrorWord
                key={i}
                word={word}
                isError={isError}
                feedback={feedback}
                onAnswer={onAnswer}
                disabled={solved}
              />
            );
          })}
        </div>
        {solved && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-6">
            <p className="text-[15px] font-medium text-sabz">{exercise.translit}</p>
            <p className="mt-1 text-[13px] text-ink-faint">
              <span lang="prs">{exercise.errorWord.dari}</span> → <span lang="prs">{exercise.correction.dari}</span>
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SpotErrorWord({
  word,
  isError,
  feedback,
  onAnswer,
  disabled,
}: {
  word: string;
  isError: boolean;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
  disabled: boolean;
}) {
  const [picked, setPicked] = useState(false);
  const showWrong = feedback === "wrong" && picked && !isError;
  if (feedback === "idle" && picked) setPicked(false);

  return (
    <motion.button
      type="button"
      lang="prs"
      disabled={disabled}
      animate={showWrong ? { x: [0, -6, 6, -3, 3, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      onClick={() => {
        setPicked(true);
        onAnswer(isError);
      }}
      className={`rounded-lg px-2 py-1 text-[26px] leading-snug transition-colors duration-200 hover:bg-line/50 ${
        showWrong ? "bg-danger/10 text-danger" : ""
      }`}
    >
      {word}
    </motion.button>
  );
}

// ---------------------------------------------------------------------------
// Shared bits (same patterns as the alphabet player)
// ---------------------------------------------------------------------------

function Prompt({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <h2 className="text-[20px] font-semibold leading-snug tracking-tight">{children}</h2>
      {hint && <p className="mt-1.5 text-[13px] text-ink-soft">{hint}</p>}
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
  children,
}: {
  correct: boolean;
  feedback: Feedback;
  onAnswer: (correct: boolean) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [picked, setPicked] = useState(false);
  const showCorrect = feedback === "correct" && correct && picked;
  const showWrong = feedback === "wrong" && picked && !correct;
  if (feedback === "idle" && picked) setPicked(false);

  return (
    <motion.button
      type="button"
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
