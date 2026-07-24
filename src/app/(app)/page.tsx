"use client";

import { Blocks, BookOpen, CircleHelp, Flame, Map, RotateCcw, SpellCheck, BarChart2, Brain } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { HomeGuideSheet } from "@/components/home/home-guide-sheet";
import { LevelForecastCard } from "@/components/home/level-forecast-card";
import { MomentumStrip } from "@/components/home/momentum-strip";
import { QuickTile, TileBadge } from "@/components/home/quick-tile";
import { TodayHero, type HeroCta } from "@/components/home/today-hero";
import { ActionCard } from "@/components/ui/action-card";
import {
  GRAMMAR_LEVEL_ORDER,
  alphabetCourse,
  grammarCourses,
  grammarLessonLevel,
  grammarLessons,
  grammarStartLevel,
  levelLabel,
} from "@/lib/content/load";
import { getTodayActivity } from "@/lib/db/activity";
import {
  useAlphabetProgress,
  useDueCount,
  useGrammarProgress,
  useProfile,
  useSupabase,
  useUser,
  useUserWords,
} from "@/lib/queries/hooks";
import { levelForecast } from "@/lib/util/level-forecast";
import { timeOfDay, type TimeOfDay } from "@/lib/util/time-of-day";
import type { PonchaPose } from "@/components/poncha";
import { useQuery } from "@tanstack/react-query";

function useTodayXp() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["activity", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const today = await getTodayActivity(db, user!.id);
      return today?.xp ?? 0;
    },
  });
}

/** Deterministic first paint (avoids a clock-based hydration mismatch). */
const TOD_DEFAULT: TimeOfDay = { phase: "day", greeting: "Salām", restPose: "greet", isNight: false };

type ActionKey = "alphabet" | "grammar" | "read" | "review" | "journey" | "practice";

export default function HomePage() {
  const { data: profile } = useProfile();
  const { data: words } = useUserWords();
  const { data: todayXp = 0 } = useTodayXp();
  const { data: alphaProgress } = useAlphabetProgress();
  const { data: grammarProgress } = useGrammarProgress();
  const dueCount = useDueCount();
  const reduce = useReducedMotion();

  // Time-of-day drives the hero; set after mount so SSR and client agree.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const tod = now ? timeOfDay(now) : TOD_DEFAULT;

  const knownCount = words?.filter((w) => w.status === "known").length ?? 0;
  const learningCount = words?.filter((w) => w.status === "learning").length ?? 0;
  const forecast = levelForecast(profile, knownCount);

  const completedUnits = alphaProgress?.filter((u) => u.completed_at).length ?? 0;
  const totalUnits = alphabetCourse.units.length;
  const showAlphabet = profile?.can_read_script === false && completedUnits < totalUnits;

  // Grammar levels the learner tested past are skipped; count only active ones.
  const startIdx = GRAMMAR_LEVEL_ORDER.indexOf(grammarStartLevel(profile?.level_estimate));
  const completedRows = new Set(
    grammarProgress?.filter((l) => l.completed_at).map((l) => l.lesson_id),
  );
  const activeLessons = grammarLessons.filter(
    (l) => GRAMMAR_LEVEL_ORDER.indexOf(grammarLessonLevel(l.id) ?? "A1") >= startIdx,
  );
  const completedLessons = activeLessons.filter((l) => completedRows.has(l.id)).length;
  const grammarComplete = completedLessons >= activeLessons.length;
  const currentGrammarLevel =
    grammarLessonLevel(activeLessons.find((l) => !completedRows.has(l.id))?.id ?? "") ??
    grammarCourses[startIdx]?.level ??
    "A1";

  const firstName = profile?.display_name?.split(" ")[0] || "there";
  const goalMet = (profile?.daily_goal ?? 30) > 0 && todayXp >= (profile?.daily_goal ?? 30);
  const streakAtRisk = (profile?.streak_current ?? 0) > 0 && todayXp === 0;

  // The single next best action → hero CTA. SRS-first: after the alphabet
  // gate, due reviews take priority, then grammar, then reading.
  const grammarHint = grammarComplete
    ? `All ${activeLessons.length} lessons done`
    : `${currentGrammarLevel} · ${completedLessons} of ${activeLessons.length} lessons`;
  const heroKey: ActionKey = showAlphabet
    ? "alphabet"
    : dueCount > 0
      ? "review"
      : !grammarComplete
        ? "grammar"
        : "read";
  const CTAS: Record<ActionKey, HeroCta> = {
    alphabet: {
      href: "/alphabet",
      label: "Learn to read Dari",
      hint: `Alphabet · ${completedUnits} of ${totalUnits} units`,
    },
    review: {
      href: "/review",
      label: `Review ${dueCount} word${dueCount === 1 ? "" : "s"}`,
      hint: "Due now · keep them fresh",
    },
    grammar: { href: "/grammar", label: "Continue Grammar", hint: grammarHint },
    read: { href: "/read", label: "Start today's reading", hint: `${levelLabel(profile?.level_estimate)} · tuned to you` },
    practice: { href: "/practice", label: "AI Practice", hint: "Converse and practice" },
    journey: { href: "/journey", label: "Journey Map", hint: "Your path" },
  };
  const heroPose: PonchaPose = goalMet ? "celebrate" : tod.restPose;

  // Everything not chosen as the hero fills the "Keep going" shelf.
  const shelfKeys = (["grammar", "read", "review", "practice"] as ActionKey[]).filter((k) => k !== heroKey);
  if (showAlphabet && heroKey !== "alphabet") shelfKeys.unshift("alphabet");

  // First home visit: open the welcome tour once the profile has resolved.
  const [showGuide, setShowGuide] = useState(false);
  useEffect(() => {
    if (!profile) return;
    if (localStorage.getItem("hasSeenHomeGuide")) return;
    const t = setTimeout(() => {
      setShowGuide(true);
      localStorage.setItem("hasSeenHomeGuide", "true");
    }, 600);
    return () => clearTimeout(t);
  }, [profile]);

  const stagger = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          animate: { opacity: 1, y: 0 },
          transition: { type: "spring" as const, stiffness: 260, damping: 26, delay },
        };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start justify-between pt-1">
        <div>
          <p className="text-[13px] text-ink-soft">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">
            {tod.greeting}, {firstName}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuide(true)}
            className="flex size-9 items-center justify-center rounded-full border border-line bg-paper text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            title="How Darya works"
          >
            <CircleHelp size={18} />
          </button>
          <Link
            href="/stats"
            className="flex size-9 items-center justify-center rounded-full border border-line bg-paper text-ink-soft transition-colors hover:bg-surface hover:text-ink"
            title="View stats"
          >
            <BarChart2 size={18} />
          </Link>
          <div
            className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-semibold ${
              (profile?.streak_current ?? 0) > 0
                ? "bg-saffron-soft text-saffron"
                : "border border-line bg-paper text-ink-faint"
            }`}
            title={streakAtRisk ? "Study today to keep your streak" : "Day streak"}
          >
            <motion.span
              animate={streakAtRisk && !reduce ? { scale: [1, 1.18, 1] } : undefined}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              className="flex"
            >
              <Flame size={17} />
            </motion.span>
            {profile?.streak_current ?? 0}
          </div>
        </div>
      </header>

      <TodayHero
        phase={tod.phase}
        pose={heroPose}
        todayXp={todayXp}
        dailyGoal={profile?.daily_goal ?? 30}
        streakCurrent={profile?.streak_current ?? 0}
        cta={CTAS[heroKey]}
      />

      <motion.section {...stagger(0.06)} className="flex flex-col gap-3">
        <p className="text-[13px] font-medium text-ink-soft">Keep going</p>
        <div className="grid grid-cols-2 gap-3">
          {shelfKeys.map((key) => {
            if (key === "alphabet")
              return (
                <QuickTile
                  key={key}
                  href="/alphabet"
                  icon={<SpellCheck size={18} />}
                  title="Alphabet"
                  detail="Learn to read Dari"
                  badge={<TileBadge>{`${completedUnits}/${totalUnits}`}</TileBadge>}
                  progress={totalUnits > 0 ? completedUnits / totalUnits : 0}
                />
              );
            if (key === "grammar")
              return (
                <QuickTile
                  key={key}
                  href="/grammar"
                  icon={<Blocks size={18} />}
                  title="Grammar"
                  detail={grammarComplete ? "All lessons done" : currentGrammarLevel}
                  badge={<TileBadge>{`${completedLessons}/${activeLessons.length}`}</TileBadge>}
                  progress={activeLessons.length > 0 ? completedLessons / activeLessons.length : 0}
                />
              );
            if (key === "read")
              return (
                <QuickTile
                  key={key}
                  href="/read"
                  icon={<BookOpen size={18} />}
                  title="Read"
                  detail={levelLabel(profile?.level_estimate)}
                />
              );
            if (key === "practice")
              return (
                <QuickTile
                  key={key}
                  href="/review?mode=practice"
                  icon={<Brain size={18} />}
                  title="Practice"
                  detail="Train your memory"
                />
              );
            // review
            return (
              <QuickTile
                key={key}
                href="/review"
                icon={<RotateCcw size={18} />}
                title="Review"
                detail={dueCount > 0 ? "words ready now" : "all caught up"}
                badge={
                  dueCount > 0 ? (
                    <TileBadge tone="lapis">{dueCount > 99 ? "99+" : dueCount}</TileBadge>
                  ) : (
                    <TileBadge tone="sabz">✓</TileBadge>
                  )
                }
              />
            );
          })}
        </div>
        <ActionCard
          href="/journey"
          icon={<Map size={20} />}
          title="Journey Map"
          subtitle="See how far you've come"
        />
      </motion.section>

      {forecast && (
        <motion.div {...stagger(0.12)}>
          <LevelForecastCard forecast={forecast} />
        </motion.div>
      )}

      <motion.div {...stagger(0.16)}>
        <MomentumStrip knownCount={knownCount} learningCount={learningCount} />
      </motion.div>

      <HomeGuideSheet
        open={showGuide}
        onClose={() => setShowGuide(false)}
        firstName={firstName}
        levelId={profile?.level_estimate}
        canReadScript={profile?.can_read_script ?? null}
      />
    </div>
  );
}
