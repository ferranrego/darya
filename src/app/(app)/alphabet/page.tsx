"use client";

import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { alphabetCourse } from "@/lib/content/load";
import { useAlphabetProgress } from "@/lib/queries/hooks";

export default function AlphabetMapPage() {
  const { data: progress } = useAlphabetProgress();
  const completed = new Set(progress?.filter((p) => p.completed_at).map((p) => p.unit_id));

  // A unit unlocks when every previous unit is complete.
  let unlocked = true;

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <h1 className="text-[26px] font-semibold tracking-tight">Alphabet</h1>
        <p className="mt-1 text-[14px] text-ink-soft">
          {completed.size} of {alphabetCourse.units.length} units · learn to read Dari, letter by letter
        </p>
      </header>

      <ol className="flex flex-col gap-3">
        {alphabetCourse.units.map((unit, i) => {
          const done = completed.has(unit.id);
          const available = unlocked;
          if (!done) unlocked = false;

          const inner = (
            <div
              className={`flex items-center gap-4 rounded-2xl border p-4 transition-all duration-200 ${
                done
                  ? "border-sabz/30 bg-sabz-soft/50"
                  : available
                    ? "border-line bg-surface hover:shadow-[0_4px_16px_rgba(31,26,23,0.06)]"
                    : "border-line/60 bg-paper opacity-55"
              }`}
            >
              <div
                lang="prs"
                className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-[24px] ${
                  done ? "bg-sabz text-white" : available ? "bg-lapis-soft text-lapis" : "bg-line/50 text-ink-faint"
                }`}
              >
                {done ? <Check size={22} strokeWidth={2.5} /> : (unit.letters[0]?.char ?? i + 1)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-medium">{unit.title}</p>
                <p className="truncate text-[13px] text-ink-soft">{unit.subtitle}</p>
              </div>
              {!available && !done && <Lock size={16} className="shrink-0 text-ink-faint" />}
            </div>
          );

          return (
            <li key={unit.id}>
              {available || done ? <Link href={`/alphabet/${unit.id}`}>{inner}</Link> : inner}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
