"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useReadTextsWithDocs } from "@/lib/queries/hooks";

export default function HistoryPage() {
  const { data: rows, isLoading } = useReadTextsWithDocs();

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
            const doc = row.texts?.doc;
            if (!doc) return null;
            return (
              <Link
                key={row.text_id}
                href={`/read/${row.text_id}`}
                className="flex flex-col gap-1 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-lapis/50"
              >
                <div className="flex items-start justify-between gap-4">
                  <h2 className="text-right text-[20px] font-medium leading-normal text-ink" lang="prs" dir="rtl">
                    {doc.titleDari}
                  </h2>
                  <span className="shrink-0 text-[12px] text-ink-soft">
                    {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(row.read_at))}
                  </span>
                </div>
                <p className="text-[14px] text-ink-soft">{doc.titleEn}</p>
                {row.texts?.theme && (
                  <div className="mt-2 self-start rounded-full bg-lapis-soft/50 px-2 py-0.5 text-[11px] font-medium text-lapis">
                    {row.texts.theme}
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
