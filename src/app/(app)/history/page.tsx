"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import Link from "next/link";
import { useSupabase, useUser } from "@/lib/queries/hooks";

export default function HistoryPage() {
  const db = useSupabase();
  const { data: user } = useUser();

  const { data: history, isLoading } = useQuery({
    queryKey: ["history", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await db
        .from("user_texts")
        .select(`
          read_at,
          words_tapped,
          texts (
            id,
            level,
            doc
          )
        `)
        .eq("user_id", user.id)
        .order("read_at", { ascending: false });
        
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Reading History</h1>
        <p className="mt-1 text-[15px] text-ink-soft">Texts you have completed</p>
      </header>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-2xl bg-surface/50" />
          ))}
        </div>
      ) : history?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BookOpen size={48} className="text-line mb-4" />
          <p className="text-[15px] text-ink-soft">You haven&apos;t read any texts yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          {history?.map((entry: any, index: number) => {
            const textData = entry.texts;
            const doc = textData.doc;
            const date = new Date(entry.read_at).toLocaleDateString();

            return (
              <div
                key={`${textData.id}-${index}`}
                className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 lang="prs" className="text-[20px] font-medium leading-snug">
                      {doc.titleDari}
                    </h3>
                    <p className="text-[14px] text-ink-soft mt-0.5">
                      {doc.titleEn}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-paper px-2.5 py-1 text-[11px] font-medium text-ink-soft border border-line/50">
                    {textData.level}
                  </span>
                </div>
                
                <div className="mt-2 flex items-center justify-between text-[12px] text-ink-faint">
                  <p>Read on {date}</p>
                  <p>{entry.words_tapped} words explored</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
