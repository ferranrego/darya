"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { TextReader } from "@/components/reader/text-reader";
import { useText } from "@/lib/queries/hooks";

export default function HistoricalReadPage() {
  const params = useParams();
  const router = useRouter();
  const id = typeof params?.id === "string" ? params.id : undefined;
  const { data: textRow, isLoading } = useText(id);

  if (isLoading) {
    return (
      <div className="animate-pulse pt-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-line/50" />
          <div className="h-10 w-2/3 rounded-lg bg-line/60" />
        </div>
        <div className="mt-10 space-y-7">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 w-full rounded-lg bg-line/50" />
              <div className="h-8 w-4/5 rounded-lg bg-line/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!textRow) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-[20px] font-semibold">Text not found</h2>
        <p className="mt-2 text-ink-soft">This story might have been removed.</p>
        <Link
          href="/profile/history"
          className="mt-6 rounded-full bg-lapis px-6 py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Back to History
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <Link
        href="/profile/history"
        className="absolute -left-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/80 backdrop-blur transition-colors hover:bg-line/50"
        aria-label="Back to history"
      >
        <ChevronLeft size={24} />
      </Link>
      <div className="pt-2">
        <TextReader
          key={textRow.id}
          doc={textRow.doc}
          onFinished={() => {
            router.push("/profile/history");
          }}
        />
      </div>
    </div>
  );
}
