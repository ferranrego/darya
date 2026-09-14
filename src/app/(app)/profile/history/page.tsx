"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Sparkles, BookOpen } from "lucide-react";
import Link from "next/link";
import { useSupabase, useUser } from "@/lib/queries/hooks";
import { profile as langProfile } from "@/lib/lang";

interface HistoryRow {
  text_id: string;
  read_at: string;
  texts: { theme: string | null; source: "seed" | "generated"; titleTarget: string; titleEn: string } | null;
}

export default function HistoryPage() {
  const db = useSupabase();
  const { data: user } = useUser();
  // Titles only. This list used to share the reader's full-document query and
  // download every text the learner had ever read to show two headings each.
  // Its own key on purpose: under `user_texts_docs` this trimmed shape would
  // reach the reader's re-read, which needs the whole document.
  const { data: rows, isLoading } = useQuery({
    queryKey: ["user_texts_titles", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await db
        .from("user_texts")
        .select("text_id, read_at, texts(theme, source, titleTarget:doc->>titleTarget, titleEn:doc->>titleEn)")
        .eq("user_id", user!.id)
        .order("read_at", { ascending: false });
      if (error) throw error;
      return data as unknown as HistoryRow[];
    },
  });

  return (
    <div className="flex flex-col gap-6 pb-12">
      <header className="flex items-center gap-3 pt-2">
        <Link
          href="/profile"
          className="flex h-10 w-10 items-center justify-center rounded-full transition-colors hover:bg-line/50"
          aria-label="Back to profile"
        >
          <ChevronLeft size={24} />
        </Link>
        <h1 className="text-[22px] font-semibold tracking-tight">Reading History</h1>
      </header>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 w-full rounded-2xl bg-line/60" />
          ))}
        </div>
      ) : rows?.length === 0 ? (
        <div className="mt-12 text-center text-ink-soft">
          <p>You haven&apos;t read any texts yet.</p>
          <p className="mt-2 text-sm">Texts you finish will appear here.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows?.map((row) => {
            const doc = row.texts;
            if (!doc) return null;
            return (
              <Link
                key={row.text_id}
                href={`/read/${row.text_id}`}
                className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-lapis/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-right text-[20px] font-medium leading-normal text-ink" lang={langProfile.code} dir={langProfile.dir}>
                    {doc.titleTarget}
                  </h2>
                  <span className="shrink-0 text-[12px] text-ink-soft">
                    {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(row.read_at))}
                  </span>
                </div>
                <p className="text-[14px] text-ink-soft">{doc.titleEn}</p>
                
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {row.texts?.theme && (
                    <div className="rounded-full bg-lapis-soft/50 px-2 py-0.5 text-[11px] font-medium text-lapis">
                      {row.texts.theme}
                    </div>
                  )}
                  {row.texts?.source === "generated" ? (
                    <div className="flex items-center gap-1 rounded-full bg-saffron-soft/50 px-2 py-0.5 text-[11px] font-medium text-saffron">
                      <Sparkles size={12} />
                      <span>On-Demand</span>
                    </div>
                  ) : row.texts?.source === "seed" ? (
                    <div className="flex items-center gap-1 rounded-full bg-sabz-soft/50 px-2 py-0.5 text-[11px] font-medium text-sabz">
                      <BookOpen size={12} />
                      <span>Curated</span>
                    </div>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
