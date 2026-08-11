"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen, WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PriorWordsSheet } from "@/components/reader/prior-words-sheet";
import { TextReader } from "@/components/reader/text-reader";
import { Button } from "@/components/ui/button";
import { levels, lexicon } from "@/lib/content/load";
import { isTeachable } from "@/lib/content/teachability";
import { beginnerPositionFor, knownSetsFor, selectUnread } from "@/lib/content/text-pool";
import { isBeginnerLevel } from "@/lib/content/word-selection";
import { updateProfile } from "@/lib/db/profiles";
import { seedKnownWords } from "@/lib/db/words";
import {
  useProfile,
  useReadTexts,
  useSupabase,
  useTextsForLevel,
  useUser,
  useUserWords,
} from "@/lib/queries/hooks";

/** Tracks the browser's online/offline state, reactively. */
function useOnline(): boolean {
  // Lazy initializer, not an effect: `navigator` is unavailable during SSR,
  // and setting the real value in an effect body after mount is exactly the
  // synchronous-setState-in-an-effect pattern that cascades an extra render.
  const [online, setOnline] = useState(() => typeof navigator === "undefined" || navigator.onLine);
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return online;
}

export default function ReadPage() {
  const db = useSupabase();
  const qc = useQueryClient();
  const router = useRouter();
  const online = useOnline();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { data: userWords } = useUserWords();
  const { data: texts, isLoading: isLoadingTexts, isFetching: isFetchingTexts, refetch } = useTextsForLevel(profile?.level_estimate);
  const { data: readRows, isLoading: isLoadingRead, isFetching: isFetchingRead, refetch: refetchRead } = useReadTexts();
  
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [emptyGenerations, setEmptyGenerations] = useState(0);
  /** Previous "a text was showable" value, for the render-time reset below. */
  const [sawText, setSawText] = useState(false);

  const readIds = useMemo(() => new Set((readRows ?? []).map((r) => r.text_id)), [readRows]);

  const trackedIds = useMemo(() => (userWords ?? []).map((w) => w.lexeme_id), [userWords]);

  /**
   * What this learner knows, split into `coverage` (may appear without
   * counting as difficulty) and `familiar` (this learner's own words) - see
   * `KnownSets` in text-pool.ts. Two incidents live behind this one memo now.
   * Reading the placement threshold off the level below an L2 learner instead
   * of their own credited them with L1's entry figure - zero - so every
   * generated text scored an unknown-word rate of 1.00 and the reader sat on
   * "Writing your next text…" forever. And the reader's own cold-start
   * fallback used to be a different sixty-word list than the one
   * `/api/generate` built the text from, so only 56-60 of the 60 words the
   * server had actually written against were recognised here, a five-sentence
   * text's worth of core vocabulary failed the gate, and the learner was told
   * after three rounds that the texts were the wrong level for them.
   * `knownSetsFor`'s `coverage` folds in the level's whole curriculum
   * vocabulary unconditionally - not just where the placement credit is thin
   * - so both classes of bug are now closed by construction rather than by a
   * threshold or a second list that can drift from the server's.
   */
  const known = useMemo(() => {
    const level = levels.find((l) => l.id === profile?.level_estimate);
    if (!level) return null;
    return knownSetsFor({ level, entries: lexicon.entries, isUsable: isTeachable, trackedIds });
  }, [profile?.level_estimate, trackedIds]);

  const priorWordIds = known?.placement ?? [];

  const [priorDismissed, setPriorDismissed] = useState(false);
  const [priorBusy, setPriorBusy] = useState(false);
  const showPriorSheet =
    !!profile &&
    !!user &&
    profile.prior_words_decision == null &&
    !priorDismissed &&
    readIds.size >= 1 &&
    priorWordIds.length > 0;

  async function decidePriorWords(decision: "seeded" | "manual") {
    if (!user) return;
    setPriorBusy(true);
    try {
      if (decision === "seeded") await seedKnownWords(db, user.id, priorWordIds);
      await updateProfile(db, user.id, { prior_words_decision: decision });
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["profile"] }),
        qc.invalidateQueries({ queryKey: ["user_words"] }),
      ]);
      setPriorDismissed(true);
    } catch (e) {
      console.error("Failed to save prior-words decision", e);
    } finally {
      setPriorBusy(false);
    }
  }

  const unread = useMemo(() => {
    if (!texts || !userWords || !known) return [];
    const level = levels.find((l) => l.id === profile?.level_estimate);
    const beginnerPosition = level && isBeginnerLevel(level) ? beginnerPositionFor(texts, readIds) : undefined;
    return selectUnread({ texts, readIds, known, activeTextId, beginnerPosition }) as typeof texts;
  }, [texts, readIds, userWords, activeTextId, known, profile?.level_estimate]);

  const generate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true })
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "generation failed");
      return res.json();
    },
    onSuccess: () => refetch(),
    // Counts generation rounds. Whether a round was *useful* cannot be known
    // here - the server writing a text is not the same as the reader being able
    // to show one, and the refetch has not been reflected in `unread` yet - so
    // the counter is cleared below the moment a text becomes available.
    onSettled: () => setEmptyGenerations((n) => n + 1),
  });

  /**
   * How many times to accept "written, but still nothing to show" before
   * giving up.
   *
   * The server and the reader measure difficulty differently on purpose - one
   * counts running words as it writes, the other counts distinct lexemes as it
   * chooses. When they disagree the server reports success and the pool stays
   * empty, so `poolEmpty` never changes, no error is ever set, and the learner
   * is left on "Writing your next text…" indefinitely with nothing to act on.
   * Counting the attempts turns that silence into a message.
   */
  const MAX_EMPTY_GENERATIONS = 3;

  // Pool empty → ask the server to write a new text.
  const isSyncing = isFetchingTexts || isFetchingRead;
  const poolEmpty = !isLoadingTexts && !isSyncing && !!readRows && unread.length === 0;

  /**
   * Clear the counter the moment a text is showable.
   *
   * Counting in the mutation callback and clearing on "finish a text" looked
   * equivalent and is not: the callback cannot see whether the round helped,
   * and the finish path is unreachable in exactly the case that matters. When
   * the text just read was the last unread one, `finish` awaits the refetch
   * before switching to the done screen, so the reader unmounts and `onFinished`
   * never runs. Three successful texts in a row therefore latched "we wrote a
   * few and none were the right level for you" - a false failure, after the
   * feature had worked three times.
   *
   * Adjusting state during render against the previous value is React's own
   * pattern for this, and unlike an effect it takes effect before the browser
   * paints the message.
   */
  const hasText = unread.length > 0;
  if (hasText !== sawText) {
    setSawText(hasText);
    if (hasText) setEmptyGenerations(0);
  }

  const gaveUp = poolEmpty && !generate.isPending && emptyGenerations >= MAX_EMPTY_GENERATIONS;

  useEffect(() => {
    if (!online) return; // no point spending an attempt against a dead connection
    if (!poolEmpty || generate.isPending || generate.isError) return;
    if (emptyGenerations >= MAX_EMPTY_GENERATIONS) return;
    generate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, poolEmpty, generate.isPending, generate.isError, emptyGenerations]);

  useEffect(() => {
    if (unread.length > 0) {
      const activeStillUnread = activeTextId != null && unread.some((t) => t.id === activeTextId);
      if (!activeStillUnread && unread[0].id !== activeTextId) {
        queueMicrotask(() => setActiveTextId(unread[0].id));
      }
    }
  }, [unread, activeTextId]);

  if (isLoadingTexts || isLoadingRead || !profile || !readRows || !userWords || (isSyncing && unread.length === 0)) {
    return <ReaderSkeleton />;
  }

  if (unread.length === 0) {
    const retry = () => {
      setEmptyGenerations(0);
      generate.mutate();
    };

    // Offline first: every other state below assumes the request it describes
    // was actually sent, which is not true here, and "Our writer is down"
    // blames the wrong thing when the real problem is the learner's own
    // connection.
    if (!online) {
      return (
        <EmptyState icon={<WifiOff size={24} />} title="You're offline">
          <p className="mx-auto mt-2 max-w-xs text-[14px] text-ink-soft">
            Your progress is saved. We&apos;ll write your next text as soon as
            you&apos;re back online.
          </p>
          <Button variant="secondary" className="mt-8" onClick={() => router.push("/history")}>
            See what you&apos;ve read
          </Button>
        </EmptyState>
      );
    }

    // A real infrastructure failure - the free-tier provider chain
    // exhausted, or every provider rejected the request. `route.ts`
    // deliberately scrubs this message before it reaches the client (see its
    // own comment), so showing it verbatim is safe and specific rather than
    // generic.
    if (generate.isError) {
      return (
        <EmptyState icon={<BookOpen size={24} />} title="Our writer is down right now">
          <p className="mx-auto mt-2 max-w-xs text-[14px] text-ink-soft">
            {generate.error instanceof Error ? generate.error.message : "Try again in a moment."}
          </p>
          <Button className="mt-8" onClick={retry}>
            Try again
          </Button>
        </EmptyState>
      );
    }

    // The server wrote texts and the reader rejected all of them - a real
    // outcome, not one to explain away. "Marking a few more words as known
    // usually fixes it" used to stand in here for a diagnosis nobody ran;
    // Review and Grammar are actual next steps rather than a repeat of the
    // same request.
    if (gaveUp) {
      return (
        <EmptyState icon={<BookOpen size={24} />} title="Nothing new to read yet">
          <p className="mx-auto mt-2 max-w-xs text-[14px] text-ink-soft">
            We wrote a few texts and none matched your level well enough to
            show. Try again, or spend a few minutes on review or grammar
            first.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <Button onClick={retry}>Try again</Button>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => router.push("/review")}>
                Review
              </Button>
              <Button variant="secondary" onClick={() => router.push("/grammar")}>
                Grammar
              </Button>
            </div>
          </div>
        </EmptyState>
      );
    }

    // In flight, or about to be - the auto-generate effect above starts the
    // request; this only has to say something true while it runs. No
    // percentage: nothing here can actually measure progress through a model
    // call, and a bar climbing toward a number that never quite means
    // anything is the thing this replaced.
    return (
      <EmptyState icon={<BookOpen size={24} />} title="Writing your next text…">
        <p className="mt-2 text-[14px] text-ink-soft">
          A fresh text with just the right new words.
        </p>
      </EmptyState>
    );
  }

  // Honour the pin. `selectUnread` keeps `activeTextId` in the pool so the text
  // being read cannot vanish mid-read, and the effect above deliberately leaves
  // the pin alone while that text is still available - but rendering `unread[0]`
  // regardless meant the pin and the rendered text could name different texts.
  // Tapping words grows the known set, which can make an older, previously
  // rejected text acceptable again; it sorts ahead, the reader swaps to it
  // mid-read and loses the tap count, and since that text is not the pinned one
  // it can drop straight back out. Reading through the pin makes the guard mean
  // what it says.
  const current = unread.find((t) => t.id === activeTextId) ?? unread[0];
  return (
    <>
      <TextReader
        key={current.doc.id}
        doc={current.doc}
        onFinished={() => {
          void refetchRead();
          // A finished text means the pipeline is working, so the previous run
          // of empty results is history and the next one starts fresh.
          setEmptyGenerations(0);
          // Keep the pool warm for next time (fire-and-forget).
          void fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ force: true })
          });
        }}
      />
      <PriorWordsSheet
        open={showPriorSheet}
        wordCount={priorWordIds.length}
        levelId={profile?.level_estimate}
        busy={priorBusy}
        onSeed={() => void decidePriorWords("seeded")}
        onManual={() => void decidePriorWords("manual")}
        onClose={() => setPriorDismissed(true)}
      />
    </>
  );
}

function EmptyState({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-32 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-lapis-soft text-lapis">
        {icon}
      </div>
      <h1 className="mt-6 text-[20px] font-semibold">{title}</h1>
      {children}
    </div>
  );
}

function ReaderSkeleton() {
  return (
    <div className="animate-pulse pt-2 w-full">
      <div className="h-10 w-2/3 rounded-lg bg-line/60" />
      <div className="mt-2 h-4 w-1/3 rounded bg-line/50" />
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
