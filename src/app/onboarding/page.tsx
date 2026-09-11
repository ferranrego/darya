"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Poncha } from "@/components/poncha";
import { Button } from "@/components/ui/button";
import { getInitialSeed, spawnRelatedWords, scoreAssessment, type AssessmentWord } from "@/lib/assessment";
import { placementControls } from "@/lib/content/load";
import type { PlacementControl } from "@/lib/content/schema";
import { lexicon, levelLabel } from "@/lib/content/load";
import { detectTimezone } from "@/lib/db/activity";
import { updateProfile } from "@/lib/db/profiles";
import { seedKnownWords, seedLearningWords } from "@/lib/db/words";
import { useSupabase } from "@/lib/queries/hooks";
import { profile as lang } from "@/lib/lang";

type Step = "hello" | "install" | "script" | "assessment" | "result";

const stepMotion = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25, ease: "easeOut" as const },
};

/** One tile in the placement grid: a real word, or an invented control. */
type GridItem =
  | { kind: "word"; word: AssessmentWord }
  | { kind: "control"; control: PlacementControl };

/**
 * Size of the opening grid, used only to scale how many controls to draw.
 *
 * Mirrors `INITIAL_SEED_SIZE` in assessment.ts rather than importing it: that
 * constant governs the sampling schedule and exporting it for this would
 * invite the two to be tuned as one number when they are two decisions.
 */
const INITIAL_SEED_SIZE_HINT = 32;

export default function OnboardingPage() {
  const router = useRouter();
  const db = useSupabase();
  /**
   * A retake goes straight to the grid.
   *
   * Until now the placement ran exactly once per account and there was no way
   * back: a learner mis-placed on their first day - by over-claiming, by
   * under-claiming, or by having learnt a lot since - was stuck there. A
   * retake re-estimates the level and can move words back into review; it
   * never deletes anything, which is enforced where it matters, in the two
   * seeding functions rather than here.
   */
  // Read from the window in a lazy initialiser rather than `useSearchParams`,
  // which forces the whole page behind a Suspense boundary and fails the
  // static prerender. The file already reads the window this way for
  // standalone detection.
  const [step, setStep] = useState<Step>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("retake") === "1"
      ? "assessment"
      : "hello",
  );
  const [canRead, setCanRead] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ estimatedVocab: number; levelId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Lazy initial state, not an effect. Seeding from an effect left the first
  // paint showing an empty word grid, and it is initialisation rather than
  // synchronisation - there is nothing outside React to keep in step with.
  const [sampledWords, setSampledWords] = useState<AssessmentWord[]>(() =>
    getInitialSeed(lexicon.entries),
  );
  const [displayedWords, setDisplayedWords] = useState<AssessmentWord[]>(sampledWords);

  /**
   * The invented words shown alongside the real ones, and which were tapped.
   *
   * Without these the test cannot tell a learner who knows 3,000 words from
   * one who taps everything - and it used to credit the second one an entire
   * frequency band per 80% claimed. They are drawn once, at the size of the
   * opening grid, and never respawn: a control that reappears after being
   * tapped would read as the app insisting, and the rate is only meaningful
   * over a fixed denominator.
   */
  const [controlsShown] = useState(() => {
    const pool = [...placementControls];
    // Seeded from nothing in particular, but drawn once per mount so the grid
    // does not rearrange between renders.
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    // Roughly one invented word per five real ones: enough that tapping
    // everything is unmistakable, few enough that an honest learner meets one
    // or two and is unbothered.
    return pool.slice(0, Math.max(6, Math.round(INITIAL_SEED_SIZE_HINT / 5)));
  });
  const [tappedControls, setTappedControls] = useState<Set<string>>(new Set());

  /**
   * Real words and invented ones in one list, interleaved rather than
   * appended: controls bunched at the end are a block a learner learns to
   * skip, and measure nothing.
   */
  const gridItems = useMemo(() => {
    const items: GridItem[] = displayedWords.map((w) => ({ kind: "word" as const, word: w }));
    const every = Math.max(3, Math.ceil(items.length / (controlsShown.length + 1)));
    controlsShown.forEach((control, i) => {
      const at = Math.min(items.length, (i + 1) * every);
      items.splice(at, 0, { kind: "control" as const, control });
    });
    return items;
  }, [displayedWords, controlsShown]);

  function reshuffle() {
    const excludeIds = new Set(sampledWords.map((w) => w.entry.id));
    const seed = getInitialSeed(lexicon.entries, excludeIds);
    setSampledWords((prev) => [...prev, ...seed]);
    setDisplayedWords(seed);
  }

  function startWizard() {
    if (
      typeof window !== "undefined" &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone)
    ) {
      setStep(lang.capabilities.scriptCourse ? "script" : "assessment");
    } else {
      setStep("install");
    }
  }

  function startAssessment(reads: boolean) {
    setCanRead(reads);
    setStep("assessment");
  }

  function goBack() {
    if (step === "assessment") {
      setStep(lang.capabilities.scriptCourse ? "script" : "install");
    } else if (step === "script") {
      setStep("install");
    } else if (step === "install") {
      setStep("hello");
    }
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
    const scored = scoreAssessment(sampledWords, selected, lexicon.entries, {
      shown: controlsShown,
      tapped: tappedControls.size,
    });
    try {
      const { data, error: authError } = await db.auth.getUser();
      if (authError || !data.user) {
        // Session gone (expired mid-wizard); sign in again and retry.
        router.push("/welcome");
        return;
      }
      await seedKnownWords(db, data.user.id, scored.knownLexemeIds);
      // The topmost band they cleared goes into the review system instead of
      // being credited outright - checked rather than assumed.
      await seedLearningWords(db, data.user.id, scored.learningLexemeIds);
      await updateProfile(db, data.user.id, {
        can_read_script: canRead,
        level_estimate: scored.levelId,
        onboarded_at: new Date().toISOString(),
        // When this learner's day rolls over. Without it everyone got
        // Barcelona midnight, so a learner in Kabul lost their streak in the
        // middle of the afternoon.
        timezone: detectTimezone(),
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

  /**
   * An invented word was tapped, or untapped.
   *
   * Deliberately does not spawn more words the way a real tap does: a control
   * is not evidence of anything to probe around, and rewarding the tap with
   * more grid would be the app agreeing.
   */
  function handleTapControl(id: string) {
    setTappedControls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleTap(word: AssessmentWord) {
    if (selected.has(word.entry.id)) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(word.entry.id);
        return next;
      });
      return;
    }

    setSelected((prev) => new Set(prev).add(word.entry.id));

    if (sampledWords.length >= 200) return;

    const excludeIds = new Set(sampledWords.map((w) => w.entry.id));
    const newWords = spawnRelatedWords(word.band, lexicon.entries, excludeIds);
    setSampledWords((prev) => [...prev, ...newWords]);
    setDisplayedWords((prev) => {
      const idx = prev.findIndex((w) => w.entry.id === word.entry.id);
      if (idx === -1) return [...prev, ...newWords];
      return [...prev.slice(0, idx + 1), ...newWords, ...prev.slice(idx + 1)];
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 py-10 relative">
      {step !== "hello" && step !== "result" && (
        <button 
          onClick={goBack} 
          className="absolute top-8 left-6 p-2 -ml-2 text-ink-soft hover:text-ink transition-colors"
          aria-label="Go back"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
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
            <p lang={lang.code} className="text-[56px] text-lapis">
              {lang.samples.greeting.target}
            </p>
            <p className="mt-1 text-[14px] text-ink-faint">
              {[lang.samples.greeting.translit, lang.samples.greeting.en]
                .filter(Boolean)
                .join(" · ")}
            </p>
            <h1 className="mt-8 text-[24px] font-semibold tracking-tight">
              You&apos;ll learn {lang.name} by reading it.
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
              {lang.brand.appName} gives you short texts where you already know almost every word,
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
              For the best experience, install {lang.brand.appName} as an app on your phone.
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
              <Button size="lg" onClick={() => setStep(lang.capabilities.scriptCourse ? "script" : "assessment")}>
                Continue
              </Button>
            </div>
          </motion.div>
        )}

        {step === "script" && (
          <motion.div key="script" {...stepMotion} className="my-auto text-center">
            <h1 className="text-[22px] font-semibold tracking-tight">
              Can you read the {lang.name} script?
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-ink-soft">
              {lang.name} is written in a script you may not know yet. Can you read
              this sentence, without looking at the Latin spelling below?
            </p>
            <p lang={lang.code} className="mt-8 text-[40px] leading-relaxed">
              {lang.samples.sentence.target}
            </p>
            {lang.samples.sentence.translit && (
              <p className="mt-2 text-[14px] text-ink-faint">{lang.samples.sentence.translit}</p>
            )}
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
              {gridItems.map((item) => {
                // A control is rendered exactly like a real word - same shape,
                // same two lines, same unvocalised script. Anything that made
                // them distinguishable would measure nothing.
                const id = item.kind === "word" ? item.word.entry.id : `ctl:${item.control.target}`;
                const target = item.kind === "word" ? item.word.entry.target : item.control.target;
                const translit =
                  item.kind === "word" ? item.word.entry.translit : item.control.translit;
                const active =
                  item.kind === "word" ? selected.has(item.word.entry.id) : tappedControls.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => (item.kind === "word" ? handleTap(item.word) : handleTapControl(id))}
                    aria-pressed={active}
                    className={`flex flex-col items-center rounded-2xl border px-4 py-2.5 transition-all duration-200 ${
                      active
                        ? "border-lapis bg-lapis text-white shadow-[0_2px_8px_rgba(43,76,140,0.3)]"
                        : "border-line bg-surface text-ink hover:border-ink-faint"
                    }`}
                  >
                    {canRead ? (
                      <>
                        <span lang={lang.code} className="text-[22px] leading-snug">
                          {target}
                        </span>
                        <span className={`text-[12px] ${active ? "text-white/75" : "text-ink-faint"}`}>
                          {translit}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="text-[19px] font-medium leading-snug">
                          {translit}
                        </span>
                        <span
                          lang={lang.code}
                          className={`text-[15px] ${active ? "text-white/70" : "text-ink-faint"}`}
                        >
                          {target}
                        </span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="fixed inset-x-0 bottom-0 border-t border-line/70 bg-paper/85 backdrop-blur-xl">
              {/* Progress bar */}
              <div 
                className="absolute top-0 left-0 h-[2px] bg-lapis transition-all duration-500 ease-out" 
                style={{ width: `${Math.min(100, (sampledWords.length / 200) * 100)}%` }} 
              />
              <div className="mx-auto max-w-xl px-6 py-4">
                {error && <p className="mb-2 text-[13px] text-danger">{error}</p>}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-[14px] text-ink-soft">
                      {selected.size} word{selected.size === 1 ? "" : "s"} selected
                    </span>
                    <span className="text-[12px] text-ink-faint mt-0.5">
                      {Math.min(sampledWords.length, 200)} / 200 probed
                    </span>
                  </div>
                  <div className="flex gap-2">
                    {selected.size === 0 && (
                      <Button disabled={busy} variant="secondary" onClick={reshuffle}>
                        Shuffle
                      </Button>
                    )}
                    <Button disabled={busy} onClick={finishAssessment}>
                      {busy ? "Working it out…" : (sampledWords.length >= 200 ? "Finish" : "I'm done")}
                    </Button>
                  </div>
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
                  ? `You already know plenty of ${lang.name}. Now let's teach you to read the script, so you can put those words on the page.`
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
