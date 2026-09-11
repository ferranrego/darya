"use client";

import { Check, Keyboard, LayoutGrid, X } from "lucide-react";
import { motion } from "motion/react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import type { LexiconEntry } from "@/lib/content/schema";
import { profile as langProfile } from "@/lib/lang";
import type { LexiconIndex } from "@/lib/lang/types";
import { checkAnswer, type AnswerCheck } from "@/lib/srs/answer-check";
import type { InputMode } from "@/lib/srs/direction";
import { hapticFeedback } from "@/lib/util/haptics";

/**
 * The card that asks a learner to write the Dari, rather than recognise it.
 *
 * This is the direction the app has never had. Everything else shows the word
 * and asks whether it is remembered - which the learner grades themselves,
 * generously, with the answer already on screen. Here the answer is not on
 * screen until they have committed to one.
 *
 * Grading is done by the app's own word-form engine, so it costs nothing and
 * covers all 6,466 entries. Both scripts are accepted at every level: a
 * learner without an Afghan keyboard can answer in Latin and still be doing
 * recall, which is the part that matters.
 */
export function ProductionCard({
  entry,
  index,
  context,
  mode,
  onModeChange,
  onGraded,
}: {
  entry: LexiconEntry;
  index: LexiconIndex;
  /** The sentence they first met it in, blanked. Optional - many words have none. */
  context?: { target: string; en: string } | null;
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  onGraded: (check: AnswerCheck, given: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [check, setCheck] = useState<AnswerCheck | null>(null);

  /**
   * Letter tiles for the answer.
   *
   * The zero-width non-joiner is dropped: it is invisible, so a tile for it
   * would be a blank square, and the grader accepts an answer without it for
   * exactly that reason. Shuffled once per word, not per render, or the tiles
   * rearrange under the learner's finger.
   */
  const tiles = useMemo(() => {
    const letters = [...entry.targetNormalized.replace(/‌/g, "")].filter((c) => c.trim().length > 0);
    // Seeded from the word itself rather than Math.random: this runs during
    // render, so an impure shuffle would rearrange the tiles under the
    // learner's finger on any re-render. Same word, same layout, every time.
    let seed = 0;
    for (const ch of entry.targetNormalized) seed = (seed * 31 + ch.codePointAt(0)!) % 2147483647;
    const shuffled = [...letters];
    for (let i = shuffled.length - 1; i > 0; i--) {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      const j = seed % (i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }, [entry.targetNormalized]);

  const assembled = picked.map((i) => tiles[i]).join("");
  const given = mode === "tiles" ? assembled : typed;
  const answered = check !== null;

  function submit() {
    if (answered || given.trim().length === 0) return;
    const result = checkAnswer(given, entry, index);
    setCheck(result);
    hapticFeedback(result.verdict === "correct" ? "success" : "warning");
  }

  const blanked = context?.target
    ? context.target.replaceAll(entry.target, "____").replaceAll(entry.targetNormalized, "____")
    : null;

  return (
    <div className="flex flex-1 flex-col gap-6 p-6">
      <header className="flex flex-col gap-2">
        <p className="text-[12px] font-bold uppercase tracking-wider text-ink-faint">
          Write it in {langProfile.name}
        </p>
        <p className="text-[26px] font-semibold leading-tight text-ink">{entry.glossEn}</p>
        {blanked ? (
          <div className="mt-2 rounded-2xl border border-line bg-surface p-4">
            <p lang={langProfile.code} dir="rtl" className="text-[19px] leading-snug text-ink">
              {blanked}
            </p>
            <p className="mt-1 text-[13px] text-ink-soft">{context!.en}</p>
          </div>
        ) : null}
      </header>

      {mode === "tiles" ? (
        <div className="flex flex-col gap-4">
          <div
            dir="rtl"
            lang={langProfile.code}
            className="flex min-h-[64px] items-center justify-center rounded-2xl border-2 border-dashed border-line bg-surface px-4 text-[28px] text-ink"
          >
            {assembled || <span className="text-[14px] text-ink-faint" dir="ltr">Tap the letters in order</span>}
          </div>
          <div dir="rtl" className="flex flex-wrap justify-center gap-2">
            {tiles.map((letter, i) => {
              const used = picked.includes(i);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={used || answered}
                  onClick={() => setPicked((p) => [...p, i])}
                  lang={langProfile.code}
                  className={`min-w-[52px] rounded-xl border px-3 py-3 text-[24px] transition-all ${
                    used
                      ? "border-line bg-line/30 text-transparent"
                      : "border-line bg-surface text-ink active:scale-95 hover:border-lapis"
                  }`}
                >
                  {letter}
                </button>
              );
            })}
          </div>
          {picked.length > 0 && !answered ? (
            <button
              type="button"
              onClick={() => setPicked((p) => p.slice(0, -1))}
              className="self-center text-[13px] font-semibold text-ink-soft underline"
            >
              Undo last letter
            </button>
          ) : null}
        </div>
      ) : (
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
          }}
          disabled={answered}
          autoFocus
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={`${langProfile.name} or the Latin spelling`}
          className="w-full rounded-2xl border border-line bg-surface p-4 text-[24px] text-ink outline-none focus:border-lapis"
        />
      )}

      {!answered ? (
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={submit} disabled={given.trim().length === 0}>
            Check
          </Button>
          {/*
            Always offered, at every level. Tiles are the default for beginners
            because an Afghan keyboard on a phone is a real barrier - but a
            learner who has one should never be held back by a default written
            for the learner who has not.
          */}
          <button
            type="button"
            onClick={() => {
              onModeChange(mode === "tiles" ? "typing" : "tiles");
              setPicked([]);
              setTyped("");
            }}
            className="flex items-center justify-center gap-2 self-center text-[13px] font-semibold text-ink-soft"
          >
            {mode === "tiles" ? <Keyboard size={15} /> : <LayoutGrid size={15} />}
            {mode === "tiles" ? "Type it instead" : "Use letter tiles instead"}
          </button>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4">
          <div
            className={`flex items-start gap-3 rounded-2xl border p-4 ${
              check.verdict === "correct"
                ? "border-sabz bg-sabz-soft/40"
                : check.verdict === "wrong-form"
                  ? "border-saffron bg-saffron-soft/40"
                  : "border-danger bg-danger/10"
            }`}
          >
            {check.verdict === "correct" ? (
              <Check size={20} className="mt-0.5 shrink-0 text-sabz" />
            ) : (
              <X size={20} className="mt-0.5 shrink-0 text-danger" />
            )}
            <div className="flex flex-col gap-1">
              <p className="text-[15px] font-semibold text-ink">
                {check.verdict === "correct"
                  ? "Right."
                  : check.verdict === "wrong-form"
                    ? "Right word, wrong form."
                    : check.resolvedTo
                      ? `That is ${check.resolvedTo.glossEn}.`
                      : "Not this time."}
              </p>
              {check.verdict !== "correct" ? (
                <>
                  <p lang={langProfile.code} dir="rtl" className="text-[24px] leading-snug text-ink">
                    {entry.target}
                  </p>
                  {entry.translit ? (
                    <p className="text-[13px] text-ink-soft">{entry.translit}</p>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
          <Button size="lg" onClick={() => onGraded(check, given)}>
            Continue
          </Button>
        </motion.div>
      )}
    </div>
  );
}
