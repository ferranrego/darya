"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { alphabetCourse } from "@/lib/content/load";
import { useAlphabetProgress } from "@/lib/queries/hooks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function AlphabetReadingPage() {
  const { data: progress } = useAlphabetProgress();
  const completed = new Set(progress?.filter((p) => p.completed_at).map((p) => p.unit_id));

  const knownLetters = new Set<string>();
  alphabetCourse.units.forEach(unit => {
    if (completed.has(unit.id)) {
      unit.letters.forEach(l => knownLetters.add(l.char));
    }
  });

  const [refreshKey, setRefreshKey] = useState(0);

  const { data: sentence, isLoading, error } = useQuery({
    queryKey: ["alphabet-reading", Array.from(knownLetters).join(","), refreshKey],
    queryFn: async () => {
      const res = await fetch("/api/generate/alphabet-reading", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ knownLetters: Array.from(knownLetters) }),
      });
      if (!res.ok) throw new Error("Failed to generate sentence");
      return res.json();
    },
    enabled: knownLetters.size > 0,
    staleTime: Infinity,
  });

  return (
    <div className="flex min-h-[calc(100dvh-8.5rem)] flex-col">
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/alphabet"
          className="flex size-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-surface hover:text-ink"
        >
          <ArrowLeft size={19} />
        </Link>
        <div>
          <p className="text-[15px] font-semibold leading-tight">Reading Assessment</p>
          <p className="text-[12px] text-ink-faint">Practice with known letters</p>
        </div>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center p-4">
        {isLoading && (
          <div className="flex flex-col items-center gap-4 w-full max-w-md">
            <Skeleton className="h-[120px] w-full rounded-3xl" />
            <Skeleton className="h-6 w-32 mt-4" />
            <Skeleton className="h-4 w-48 mt-2" />
          </div>
        )}

        {error && (
          <div className="text-red-500">
            <p>Failed to generate sentence. Please try again.</p>
            <Button onClick={() => setRefreshKey(k => k + 1)} className="mt-4">Retry</Button>
          </div>
        )}

        {sentence && (
          <div className="flex flex-col items-center max-w-md w-full gap-8">
            <div className="rounded-3xl border border-line bg-surface p-8 w-full shadow-sm">
              <p lang="prs" className="text-[36px] font-bold text-ink leading-normal" dir="rtl">
                {sentence.dari}
              </p>
            </div>
            
            <div className="flex flex-col gap-2 w-full text-left">
              <p className="text-[14px] text-ink-soft uppercase tracking-wider font-semibold">Translation</p>
              <p className="text-[18px] text-ink font-medium">{sentence.en}</p>
              <p className="text-[15px] text-ink-soft mt-1">{sentence.translit}</p>
            </div>

            <Button size="lg" className="w-full mt-4" onClick={() => setRefreshKey(k => k + 1)}>
              Next Sentence
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
