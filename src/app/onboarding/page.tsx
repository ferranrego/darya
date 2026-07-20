"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { sampleAssessmentWords, scoreAssessment } from "@/lib/assessment";
import { lexicon } from "@/lib/content/load";
import { updateProfile } from "@/lib/db/profiles";
import { seedKnownWords } from "@/lib/db/words";
import { useSupabase, useUser } from "@/lib/queries/hooks";

type Step = "hello" | "script" | "assessment" | "result" | "alphabet";

const stepMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export default function OnboardingPage() {
  const router = useRouter();
  const db = useSupabase();
  const { data: user } = useUser();
  const [step, setStep] = useState<Step>("hello");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ estimatedVocab: number; levelId: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const words = useMemo(() => sampleAssessmentWords(lexicon.entries), []);

  async function finishAsReader() {
    if (!user) return;
    setBusy(true);
    const scored = scoreAssessment(words, selected, lexicon.entries);
    await seedKnownWords(db, user.id, scored.knownLexemeIds);
    await updateProfile(db, user.id, {
      can_read_script: true,
      level_estimate: scored.levelId,
      onboarded_at: new Date().toISOString(),
    });
    setResult(scored);
    setBusy(false);
    setStep("result");
  }

  async function finishAsLearner() {
    if (!user) return;
    setBusy(true);
    await updateProfile(db, user.id, {
      can_read_script: false,
      level_estimate: "L1",
      onboarded_at: new Date().toISOString(),
    });
    setBusy(false);
    router.push("/alphabet");
    router.refresh();
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 py-10">
      <AnimatePresence mode="wait">
        {step === "hello" && (
          <motion.div key="hello" {...stepMotion} className="my-auto text-center">
            <p lang="prs" className="text-[56px] text-lapis">
              خوش آمدید
            </p>
            <p className="mt-1 text-[14px] text-ink-faint">khush āmadēd — welcome</p>
            <h1 className="mt-8 text-[24px] font-semibold tracking-tight">
              You&apos;ll learn Dari by reading it.
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
              Darya gives you short texts where you already know almost every word —
              just enough new ones to grow. Tap any word to see what it means.
            </p>
            <Button size="lg" className="mt-10" onClick={() => setStep("script")}>
              Let&apos;s begin
            </Button>
          </motion.div>
        )}

        {step === "script" && (
          <motion.div key="script" {...stepMotion} className="my-auto text-center">
            <h1 className="text-[22px] font-semibold tracking-tight">Can you read this?</h1>
            <p lang="prs" className="mt-8 text-[40px] leading-relaxed">
              سلام، چطور هستید؟
            </p>
            <p className="mt-2 text-[14px] text-ink-faint">salām, chetōr hastēd?</p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <Button size="lg" onClick={() => setStep("assessment")}>
                Yes, I can read it
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setStep("alphabet")}>
                Not yet
              </Button>
            </div>
          </motion.div>
        )}

        {step === "alphabet" && (
          <motion.div key="alphabet" {...stepMotion} className="my-auto text-center">
            <p lang="prs" className="text-[56px] text-lapis">
              ا ب پ
            </p>
            <h1 className="mt-6 text-[22px] font-semibold tracking-tight">
              We&apos;ll teach you the script first.
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
              Eight short units take you from single letters to reading real Dari
              sentences. You&apos;ll be reading words within minutes.
            </p>
            <Button size="lg" className="mt-10" disabled={busy} onClick={finishAsLearner}>
              {busy ? "Setting up…" : "Start the alphabet course"}
            </Button>
          </motion.div>
        )}

        {step === "assessment" && (
          <motion.div key="assessment" {...stepMotion} className="flex flex-1 flex-col">
            <h1 className="text-[22px] font-semibold tracking-tight">
              Tap the words you recognize
            </h1>
            <p className="mt-2 text-[14px] text-ink-soft">
              Be honest — this sets your starting point. Skip anything unfamiliar.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-2.5 pb-28">
              {words.map((w, i) => {
                const active = selected.has(w.entry.id);
                return (
                  <motion.button
                    key={w.entry.id}
                    type="button"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.03, 1.2), duration: 0.3 }}
                    onClick={() => toggle(w.entry.id)}
                    aria-pressed={active}
                    className={`flex flex-col items-center rounded-2xl border px-4 py-2.5 transition-all duration-200 ${
                      active
                        ? "border-lapis bg-lapis text-white shadow-[0_2px_8px_rgba(43,76,140,0.3)]"
                        : "border-line bg-surface text-ink hover:border-ink-faint"
                    }`}
                  >
                    <span lang="prs" className="text-[22px] leading-snug">
                      {w.entry.dari}
                    </span>
                    <span className={`text-[12px] ${active ? "text-white/75" : "text-ink-faint"}`}>
                      {w.entry.translit}
                    </span>
                  </motion.button>
                );
              })}
            </div>
            <div className="fixed inset-x-0 bottom-0 border-t border-line/70 bg-paper/85 backdrop-blur-xl">
              <div className="mx-auto flex max-w-xl items-center justify-between px-6 py-4">
                <span className="text-[14px] text-ink-soft">
                  {selected.size} word{selected.size === 1 ? "" : "s"}
                </span>
                <Button disabled={busy} onClick={finishAsReader}>
                  {busy ? "Working it out…" : "I'm done"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {step === "result" && result && (
          <motion.div key="result" {...stepMotion} className="my-auto text-center">
            <p className="text-[14px] font-medium uppercase tracking-wide text-ink-faint">
              Your starting point
            </p>
            <p className="mt-4 text-[56px] font-semibold tracking-tight text-lapis">
              ~{result.estimatedVocab}
            </p>
            <p className="text-[15px] text-ink-soft">words you already know</p>
            <p className="mt-6 inline-block rounded-full bg-lapis-soft px-4 py-1.5 text-[14px] font-medium text-lapis">
              Level {result.levelId.replace("L", "")} ·{" "}
              {result.levelId === "L1" ? "First words" : "ready to read"}
            </p>
            <div className="mt-10">
              <Button
                size="lg"
                onClick={() => {
                  router.push("/read");
                  router.refresh();
                }}
              >
                Start reading
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
