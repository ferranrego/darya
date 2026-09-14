"use client";

import { ChevronRight, Search, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { AskTutorLink } from "@/components/grammar-hub/ask-tutor-link";
import { EntryRow } from "@/components/grammar-hub/entry-row";
import { Poncha } from "@/components/poncha";
import {
  HUB_CHAPTER_TITLE,
  hubEntries,
  hubEntriesForLevel,
  hubLevels,
  hubMostLookedUp,
} from "@/lib/content/grammar-hub";
import { grammarStartLevel } from "@/lib/content/courses";
import type { GrammarLevel } from "@/lib/content/schema";
import { searchHub } from "@/lib/grammar-hub/search";
import { profile as lang } from "@/lib/lang";
import { useGrammarProgress, useProfile } from "@/lib/queries/hooks";

export default function GrammarHubPage() {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { data: profile } = useProfile();
  const { data: progress } = useGrammarProgress();

  const completed = useMemo(
    () => new Set(progress?.filter((p) => p.completed_at).map((p) => p.lesson_id)),
    [progress],
  );
  const studied = (lessonIds: string[]) => lessonIds.some((id) => completed.has(id));

  // Only marked once the profile has loaded: before that grammarStartLevel
  // falls back to A1, and every learner would briefly be told A1 is theirs.
  const ownLevel: GrammarLevel | null = profile ? grammarStartLevel(profile.level_estimate) : null;

  const hits = useMemo(() => searchHub(query, hubEntries), [query]);
  const searching = query.trim().length > 0;

  function jumpTo(level: GrammarLevel) {
    document.getElementById(`chapter-${level}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function browseFromStart() {
    setQuery("");
    // Wait for the chapters to render back in before scrolling to them.
    requestAnimationFrame(() => jumpTo(hubLevels[0]));
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Grammar Hub</h1>
        <p className="mt-1 text-[15px] text-ink-soft">
          Your {lang.name} grammar book. Look up any rule, from first steps to fluent.
        </p>
      </header>

      {/* Search and chapter chips stay reachable while the book scrolls. Solid
          paper, not glass: the tab bar is the app's only translucent surface. */}
      <div className="sticky top-0 z-20 -mx-5 flex flex-col gap-3 bg-paper px-5 pb-3 pt-2">
        <label className="relative block">
          <span className="sr-only">Search the grammar book</span>
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
          />
          <input
            ref={inputRef}
            type="search"
            dir="auto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: ezafe, plural, past tense..."
            autoComplete="off"
            enterKeyHint="search"
            className="h-12 w-full rounded-2xl border border-line bg-surface pl-11 pr-11 text-[16px] outline-none placeholder:text-ink-faint focus:border-lapis [&::-webkit-search-cancel-button]:hidden"
          />
          {searching && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className="absolute right-1.5 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint hover:text-ink"
            >
              <X size={18} />
            </button>
          )}
        </label>

        {!searching && (
          <div className="flex gap-2" role="navigation" aria-label="Chapters">
            {hubLevels.map((level) => {
              const own = level === ownLevel;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => jumpTo(level)}
                  className={`flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${
                    own ? "bg-lapis text-white" : "border border-line bg-surface text-ink-soft hover:text-ink"
                  }`}
                >
                  {level}
                  {own && <span className="text-[11px] font-medium opacity-80">You</span>}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {searching ? (
        hits.length > 0 ? (
          <section aria-live="polite" className="-mt-3 flex flex-col gap-2">
            <p className="text-[13px] text-ink-soft">
              {hits.length === 1 ? "1 page" : `${hits.length} pages`}
            </p>
            <div className="overflow-hidden rounded-2xl border border-line bg-surface">
              {hits.map((hit, i) => (
                <EntryRow
                  key={hit.entry.id}
                  entry={hit.entry}
                  studied={studied(hit.entry.lessonIds)}
                  showLevel
                  first={i === 0}
                />
              ))}
            </div>
          </section>
        ) : (
          <section
            aria-live="polite"
            className="-mt-3 flex flex-col items-center rounded-2xl border border-line bg-surface px-6 pb-6 pt-4 text-center"
          >
            <Poncha pose="read" size={110} />
            <p className="mt-3 text-[17px] font-medium">Nothing in the book for &ldquo;{query.trim()}&rdquo;</p>
            <p className="mt-1 max-w-xs text-[14px] text-ink-soft">
              Try another word for it, or ask {lang.brand.mascotName}. She can explain it with examples.
            </p>
            <div className="mt-5 flex flex-col items-center gap-2">
              <AskTutorLink question={`Can you explain this ${lang.name} grammar point: ${query.trim()}?`} />
              <button
                type="button"
                onClick={browseFromStart}
                className="h-11 px-4 text-[15px] font-medium text-lapis"
              >
                Browse the book
              </button>
            </div>
          </section>
        )
      ) : (
        <>
          {hubMostLookedUp.length > 0 && (
            <section className="-mt-3 flex flex-col gap-3">
              <p className="text-[13px] font-medium text-ink-soft">Most looked up</p>
              {/* Bleeds to the screen edge so the row reads as scrollable. */}
              <div className="-mx-5 flex snap-x scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
                {hubMostLookedUp.map((entry) => (
                  <Link
                    key={entry.id}
                    href={`/grammar-hub/${entry.slug}`}
                    className="flex w-40 shrink-0 snap-start flex-col justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(31,26,23,0.06)]"
                  >
                    <span lang={lang.code} dir={lang.dir} className="text-[24px] leading-[1.6] text-lapis">
                      {entry.sample.target}
                    </span>
                    <span>
                      <span className="block text-[15px] font-medium leading-tight">{entry.title}</span>
                      <span className="mt-0.5 block text-[12.5px] text-ink-soft">{entry.sample.translit}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {hubLevels.map((level) => {
            const entries = hubEntriesForLevel(level);
            return (
              <section key={level} id={`chapter-${level}`} className="flex scroll-mt-32 flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-[22px] font-semibold tracking-tight">
                    <span className="text-lapis">{level}</span>
                    <span className="text-ink-faint"> · </span>
                    {HUB_CHAPTER_TITLE[level]}
                  </h2>
                  <span className="text-[13px] text-ink-soft">
                    {entries.length === 1 ? "1 page" : `${entries.length} pages`}
                  </span>
                </div>
                <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                  {entries.map((entry, i) => (
                    <EntryRow
                      key={entry.id}
                      entry={entry}
                      studied={studied(entry.lessonIds)}
                      first={i === 0}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          <Link
            href="/grammar"
            className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4 text-[15px]"
          >
            <span>
              <span className="block font-medium">Want to practise?</span>
              <span className="block text-[13px] text-ink-soft">The grammar course teaches these step by step.</span>
            </span>
            <ChevronRight size={18} className="text-ink-faint" />
          </Link>
        </>
      )}
    </div>
  );
}
