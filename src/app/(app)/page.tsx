"use client";

import { Blocks, BookOpen, Flame, RotateCcw, SpellCheck } from "lucide-react";
import Link from "next/link";
import { ActionCard } from "@/components/ui/action-card";
import { ProgressRing } from "@/components/ui/progress-ring";
import {
  GRAMMAR_LEVEL_ORDER,
  alphabetCourse,
  grammarCourses,
  grammarLessonLevel,
  grammarLessons,
  grammarStartLevel,
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

export default function HomePage() {
  const { data: profile } = useProfile();
  const { data: words } = useUserWords();
  const { data: todayXp = 0 } = useTodayXp();
  const { data: alphaProgress } = useAlphabetProgress();
  const { data: grammarProgress } = useGrammarProgress();
  const dueCount = useDueCount();

  const knownCount = words?.filter((w) => w.status === "known").length ?? 0;
  const learningCount = words?.filter((w) => w.status === "learning").length ?? 0;

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
  // Current level = the level of the first not-yet-done active lesson.
  const currentGrammarLevel =
    grammarLessonLevel(activeLessons.find((l) => !completedRows.has(l.id))?.id ?? "") ??
    grammarCourses[startIdx]?.level ??
    "A1";

  const firstName = profile?.display_name?.split(" ")[0] || "there";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start justify-between pt-2">
        <div>
          <p className="text-[14px] text-ink-soft">
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>
          <h1 className="mt-1 text-[26px] font-semibold tracking-tight">Salām, {firstName}</h1>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[15px] font-semibold ${
            (profile?.streak_current ?? 0) > 0 ? "bg-saffron-soft text-saffron" : "bg-paper text-ink-faint border border-line"
          }`}
          title="Day streak"
        >
          <Flame size={17} />
          {profile?.streak_current ?? 0}
        </div>
      </header>

      <section className="flex items-center justify-center py-2">
        <ProgressRing value={todayXp} max={profile?.daily_goal ?? 30} size={148} stroke={10}>
          <div className="text-center">
            <p className="text-[30px] font-semibold leading-none tracking-tight">{todayXp}</p>
            <p className="mt-1 text-[12px] text-ink-faint">of {profile?.daily_goal ?? 30} XP</p>
          </div>
        </ProgressRing>
      </section>

      <section className="flex flex-col gap-3">
        {showAlphabet && (
          <ActionCard
            href="/alphabet"
            icon={<SpellCheck size={20} />}
            title="Alphabet course"
            subtitle={`${completedUnits} of ${totalUnits} units · learn to read Dari`}
            accent
          />
        )}
        <ActionCard
          href="/grammar"
          icon={<Blocks size={20} />}
          title="Grammar"
          subtitle={
            grammarComplete
              ? `All ${activeLessons.length} lessons done · how Dari fits together`
              : `${currentGrammarLevel} · ${completedLessons} of ${activeLessons.length} lessons · how Dari fits together`
          }
          accent={!showAlphabet && !grammarComplete}
        />
        <ActionCard
          href="/read"
          icon={<BookOpen size={20} />}
          title="Read"
          subtitle={`Level ${profile?.level_estimate?.replace("L", "") ?? "1"} · texts tuned to your words`}
          accent={!showAlphabet && grammarComplete}
        />
        <ActionCard
          href="/review"
          icon={<RotateCcw size={20} />}
          title="Review"
          subtitle={dueCount > 0 ? `${dueCount} word${dueCount === 1 ? "" : "s"} ready` : "Nothing due, all caught up"}
        />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link
          href="/words?filter=known"
          className="rounded-2xl border border-line bg-surface p-4 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(31,26,23,0.06)]"
        >
          <p className="text-[26px] font-semibold tracking-tight text-sabz">{knownCount}</p>
          <p className="text-[13px] text-ink-soft">words known</p>
        </Link>
        <Link
          href="/words?filter=learning"
          className="rounded-2xl border border-line bg-surface p-4 transition-all duration-200 hover:shadow-[0_4px_16px_rgba(31,26,23,0.06)]"
        >
          <p className="text-[26px] font-semibold tracking-tight text-lapis">{learningCount}</p>
          <p className="text-[13px] text-ink-soft">words learning</p>
        </Link>
      </section>
    </div>
  );
}
