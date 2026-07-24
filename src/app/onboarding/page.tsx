"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Poncha } from "@/components/poncha";
import { Button } from "@/components/ui/button";
import { sampleAssessmentWords, scoreAssessment } from "@/lib/assessment";
import { lexicon, levelLabel } from "@/lib/content/load";
import { updateProfile } from "@/lib/db/profiles";
import { seedKnownWords } from "@/lib/db/words";
import { useSupabase } from "@/lib/queries/hooks";

type Step = "hello" | "install" | "script" | "assessment" | "result";

const stepMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

export default function OnboardingPage() {
  const router = useRouter();
  const db = useSupabase();
  const [step, setStep] = useState<Step>("hello");
  const [canRead, setCanRead] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ estimatedVocab: number; levelId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const words = useMemo(() => sampleAssessmentWords(lexicon.entries), []);

  function startWizard() {
    if (
      typeof window !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone)
    ) {
      setStep("script");
    } else {
      setStep("install");
    }
  }

  function startAssessment(reads: boolean) {
    setCanRead(reads);
    setStep("assessment");
  }

  /**
   * Everyone takes the vocabulary assessment, whether or not they can read the
   * script: a heritage speaker may know hundreds of words yet not read a letter.
   * We store reading ability and estimated level independently, so a non-reader
   * still lands in the alphabet course but with the right words already known.
   */
  async function finishAssessment() {
    setBusy(true);
    setError(null);
    const scored = scoreAssessment(words, selected, lexicon.entries);
    try {
      const { data, error: authError } = await db.auth.getUser();
      if (authError || !data.user) {
        // Session gone (expired mid-wizard); sign in again and retry.
        router.push("/welcome");
        return;
      }
      await seedKnownWords(db, data.user.id, scored.knownLexemeIds);
      await updateProfile(db, data.user.id, {
        can_read_script: canRead,
        level_estimate: scored.levelId,
        onboarded_at: new Date().toISOString(),
      });
    } catch {
      setError("Couldn't save your results. Check your connection and try again.");
      return;
    } finally {
      setBusy(false);
    }
    setResult(scored);
    setStep("result");
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
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 18 }}
              className="mb-6 flex justify-center"
            >
              <Poncha pose="greet" size={180} priority />
            </motion.div>
            <p lang="prs" className="text-[56px] text-lapis">
              خوش آمدید
            </p>
            <p className="mt-1 text-[14px] text-ink-faint">khush āmadēd · welcome</p>
            <h1 className="mt-8 text-[24px] font-semibold tracking-tight">
              You&apos;ll learn Dari by reading it.
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
              Darya gives you short texts where you already know almost every word,
              plus just enough new ones to grow. Tap any word to see what it means.
            </p>
            <Button size="lg" className="mt-10" onClick={startWizard}>
              Let&apos;s begin
            </Button>
          </motion.div>
        )}

        {step === "install" && (
          <motion.div key="install" {...stepMotion} className="my-auto text-center">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-lapis text-white shadow-[0_4px_16px_rgba(43,76,140,0.3)]">
                <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </div>
            </div>
            <h1 className="mt-8 text-[24px] font-semibold tracking-tight">
              Add to Home Screen
            </h1>
            <p className="mx-auto mt-4 max-w-sm text-[15px] leading-relaxed text-ink-soft">
              For the best experience, install Darya as an app on your phone.
            </p>
            <div className="mx-auto mt-8 flex max-w-xs flex-col gap-4 rounded-2xl border border-line bg-surface p-5 text-left text-[14.5px] text-ink-soft">
              <p className="flex items-center gap-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-line/50 text-[11px] font-bold text-ink">1</span>
                <span>Tap <strong>Share</strong> (iOS) or <strong>Menu</strong> (Android)</span>
              </p>
              <p className="flex items-center gap-3.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-line/50 text-[11px] font-bold text-ink">2</span>
                <span>Select <strong>Add to Home Screen</strong></span>
              </p>
            </div>
            <div className="mt-10 flex flex-col items-center gap-3">
              <Button size="lg" onClick={() => setStep("script")}>
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {step === "script" && (
          <motion.div key="script" {...stepMotion} className="my-auto text-center">
            <h1 className="text-[22px] font-semibold tracking-tight">
              Can you read the Dari script?
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
              Dari is written in the Perso-Arabic script. Can you read this sentence
              in it, without looking at the Latin spelling below?
            </p>
            <p lang="prs" className="mt-8 text-[40px] leading-relaxed">
              سلام، چطور هستید؟
            </p>
            <p className="mt-2 text-[14px] text-ink-faint">salām, chetōr hastēd?</p>
            <div className="mt-10 flex flex-col items-center gap-3">
              <Button size="lg" onClick={() => startAssessment(true)}>
                Yes, I can read it
              </Button>
              <Button size="lg" variant="secondary" onClick={() => startAssessment(false)}>
                Not yet
              </Button>
            </div>
          </motion.div>
        )}

        {step === "assessment" && (
          <motion.div key="assessment" {...stepMotion} className="flex flex-1 flex-col">
            <h1 className="text-[22px] font-semibold tracking-tight">
              {canRead ? "Tap the words you recognize" : "Tap the words you know"}
            </h1>
            <p className="mt-2 text-[14px] text-ink-soft">
              {canRead
                ? "Be honest, this sets your starting point. Skip anything unfamiliar."
                : "Read the Latin spelling out loud. Tap the ones you already know, even if you can't read the script yet."}
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
                    {canRead ? (
                      <>
                        <span lang="prs" className="text-[22px] leading-snug">
                          {w.entry.dari}
                        </span>
                        <span className={`text-[12px] ${active ? "text-white/75" : "text-ink-faint"}`}>
                          {w.entry.translit}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[19px] font-medium leading-snug">
                          {w.entry.translit}
                        </span>
                        <span
                          lang="prs"
                          className={`text-[15px] ${active ? "text-white/70" : "text-ink-faint"}`}
                        >
                          {w.entry.dari}
                        </span>
                      </>
                    )}
                  </motion.button>
                );
              })}
            </div>
            <div className="fixed inset-x-0 bottom-0 border-t border-line/70 bg-paper/85 backdrop-blur-xl">
              <div className="mx-auto max-w-xl px-6 py-4">
                {error && <p className="mb-2 text-[13px] text-danger">{error}</p>}
                <div className="flex items-center justify-between">
                  <span className="text-[14px] text-ink-soft">
                    {selected.size} word{selected.size === 1 ? "" : "s"}
                  </span>
                  <Button disabled={busy} onClick={finishAssessment}>
                    {busy ? "Working it out…" : "I'm done"}
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {step === "result" && result && (
          <motion.div key="result" {...stepMotion} className="my-auto text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 260, damping: 18 }}
              className="mb-5 flex justify-center"
            >
              <Poncha pose="celebrate" size={150} />
            </motion.div>
            <p className="text-[14px] font-medium uppercase tracking-wide text-ink-faint">
              Your starting point
            </p>
            <p className="mt-4 text-[56px] font-semibold tracking-tight text-lapis">
              ~{result.estimatedVocab}
            </p>
            <p className="text-[15px] text-ink-soft">words you already know</p>
            <p className="mt-6 inline-block rounded-full bg-lapis-soft px-4 py-1.5 text-[14px] font-medium text-lapis">
              {levelLabel(result.levelId)}
            </p>

            {!canRead && (
              <p className="mx-auto mt-6 max-w-sm text-[15px] leading-relaxed text-ink-soft">
                {result.estimatedVocab > 0
                  ? "You already know plenty of Dari. Now let's teach you to read the script, so you can put those words on the page."
                  : "Let's start at the very beginning and teach you to read the script, letter by letter."}
              </p>
            )}
            <div className={canRead ? "mt-10" : "mt-8"}>
              <Button
                size="lg"
                onClick={() => {
                  router.push("/");
                  router.refresh();
                }}
              >
                Start learning
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
