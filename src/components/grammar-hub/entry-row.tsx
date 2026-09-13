import { Check, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { HubEntry } from "@/lib/content/schema";
import { profile as lang } from "@/lib/lang";

/**
 * One page in the book's table of contents: what it is called, the rule in
 * a line, and a short Dari sample so the learner can recognise the thing they
 * saw in a text even when they do not know its name.
 */
export function EntryRow({
  entry,
  studied = false,
  showLevel = false,
  first = false,
}: {
  entry: HubEntry;
  /** A course lesson that practises this page is done. */
  studied?: boolean;
  showLevel?: boolean;
  first?: boolean;
}) {
  return (
    <Link
      href={`/grammar-hub/${entry.slug}`}
      className={`group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors active:bg-paper ${
        first ? "" : "border-t border-line/60"
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {showLevel && (
            <span className="rounded-full bg-paper px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
              {entry.level}
            </span>
          )}
          <p className="truncate text-[16px] font-medium text-ink">{entry.title}</p>
          {studied && (
            <span
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-sabz-soft text-sabz"
              title="You studied this in a lesson"
            >
              <Check size={11} strokeWidth={3} aria-label="Studied in a lesson" />
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-soft">{entry.summary}</p>
      </div>
      <span lang={lang.code} dir={lang.dir} className="shrink-0 text-[19px] text-lapis">
        {entry.sample.target}
      </span>
      <ChevronRight size={16} className="shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
