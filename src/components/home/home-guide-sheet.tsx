"use client";

import {
  Blocks,
  BookOpen,
  Flame,
  Map,
  RotateCcw,
  SpellCheck,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Poncha } from "@/components/poncha";
import { Button } from "@/components/ui/button";
import { levelLabel, levels } from "@/lib/content/load";
import { profile as lang } from "@/lib/lang";

/**
 * One-time (and on-demand) welcome tour for the home page, shown the first
 * time a learner lands here after onboarding. Poncha walks through the app's
 * sections, personalized to the profile: someone who tested at B1 but can't
 * read the script is told the alphabet comes first; readers are pointed at
 * Grammar and Reading tuned to their level.
 */
export function HomeGuideSheet({
  open,
  onClose,
  firstName,
  levelId,
  canReadScript,
}: {
  open: boolean;
  onClose: () => void;
  firstName: string;
  levelId: string | undefined;
  canReadScript: boolean | null;
}) {
  const needsAlphabet = canReadScript === false;
  // L1 = pre-A1, L2 = A1; anything above that counts as "tested well".
  const beyondBeginner = levels.findIndex((l) => l.id === levelId) >= 2;
  const level = levelLabel(levelId);

  const callout = needsAlphabet
    ? beyondBeginner
      ? {
          title: `You tested at ${level} - impressive!`,
          body: `But the ${lang.name} script comes first: start with the Alphabet course, and everything else opens up once you can read.`,
        }
      : {
          title: "First stop: the Alphabet course",
          body: `Learn to read the ${lang.name} script and every word in the app opens up.`,
        }
    : {
        title: `You tested at ${level}`,
        body: "Grammar lessons and Reading texts are tuned to start right at your level - no wading through basics you already know.",
      };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="home-guide-scrim"
            className="fixed inset-0 z-40 bg-ink/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            key="home-guide-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`Welcome to ${lang.brand.appName}`}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-b-0 border-line bg-surface px-6 pt-3 shadow-[0_-8px_40px_rgba(31,26,23,0.12)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="mx-auto mb-5 h-1 w-9 shrink-0 rounded-full bg-line" />

            <div className="flex items-center gap-4">
              <Poncha pose="wave" size={72} animated />
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight">Salām, {firstName}!</h2>
                <p className="mt-0.5 text-[14px] text-ink-soft">
                  Poncha here - let me show you around.
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-saffron-soft p-4">
              <p className="text-[14px] font-semibold">{callout.title}</p>
              <p className="mt-1 text-[13px] leading-snug text-ink-soft">{callout.body}</p>
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {needsAlphabet && (
                <TourRow
                  icon={SpellCheck}
                  label="Alphabet"
                  description={`Short units that teach you to read the ${lang.name} script.`}
                  startHere
                />
              )}
              <TourRow
                icon={Blocks}
                label="Grammar"
                description={`Bite-size lessons on how ${lang.name} fits together, from your level up.`}
                startHere={!needsAlphabet}
              />
              <TourRow
                icon={BookOpen}
                label="Read"
                description="Texts tuned to the words you know - tap any word to learn it."
              />
              <TourRow
                icon={RotateCcw}
                label="Review"
                description="Words you tap come back as flashcards until they stick."
              />
            </div>

            <div className="mt-6 flex flex-col gap-2 rounded-2xl bg-paper p-4 text-[13px] text-ink-soft">
              <div className="flex items-center gap-2.5">
                <Flame size={15} className="shrink-0 text-ink-faint" />
                <span>Hit your daily XP goal to keep your streak alive</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Map size={15} className="shrink-0 text-ink-faint" />
                <span>The Journey Map shows your whole path ahead</span>
              </div>
            </div>

            <Button size="lg" className="mt-6 w-full" onClick={onClose}>
              Let&apos;s go
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function TourRow({
  icon: Icon,
  label,
  description,
  startHere = false,
}: {
  icon: LucideIcon;
  label: string;
  description: string;
  startHere?: boolean;
}) {
  return (
    <div className="flex items-center gap-4">
      <div
        className={`flex w-[76px] shrink-0 items-center justify-center rounded-xl border py-3.5 ${
          startHere ? "border-saffron/40 bg-saffron-soft text-saffron" : "border-line bg-surface text-ink-soft"
        }`}
      >
        <Icon size={22} />
      </div>
      <div>
        <p className="flex items-center gap-2 text-[14px] font-semibold">
          {label}
          {startHere && (
            <span className="rounded-full bg-saffron-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-saffron">
              Start here
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{description}</p>
      </div>
    </div>
  );
}
