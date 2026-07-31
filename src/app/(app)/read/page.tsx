"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PriorWordsSheet } from "@/components/reader/prior-words-sheet";
import { TextReader } from "@/components/reader/text-reader";
import { Button } from "@/components/ui/button";
import { levels, lexicon } from "@/lib/content/load";
import { placementCredit, selectUnread } from "@/lib/content/text-pool";
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

export default function ReadPage() {
  const db = useSupabase();
  const qc = useQueryClient();
  const { data: user } = useUser();
  const { data: profile } = useProfile();
  const { data: userWords } = useUserWords();
  const { data: texts, isLoading, refetch } = useTextsForLevel(profile?.level_estimate);
  const { data: readRows, refetch: refetchRead } = useReadTexts();
  
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [emptyGenerations, setEmptyGenerations] = useState(0);
  const [showRetry, setShowRetry] = useState(false);

  const readIds = useMemo(() => new Set((readRows ?? []).map((r) => r.text_id)), [readRows]);

  /**
   * The words the placement credits this learner with but which have no row
   * yet - offered as a one-time bulk "mark as known" (see PriorWordsSheet), and
   * counted as known when judging whether a text is too hard.
   *
   * The threshold is the learner's *own* level's `entryKnownWords`, which is
   * exactly what that field means: how many words you need in order to be at
   * this level. Reading it off the level below instead credited an L2 learner
   * with L1's entry figure - zero - so the placement gave them nothing, every
   * generated text scored an unknown-word rate of 1.00, and the reader sat on
   * "Writing your next text…" for ever. It only looked fixed at L3, where the
   * under-credit of 110 instead of 500 still happened to clear the bar.
   */
  const priorWordIds = useMemo(() => {
    const level = levels.find((l) => l.id === profile?.level_estimate);
    if (!level || !userWords) return [];
    return placementCredit(
      level.entryKnownWords,
      lexicon.entries,
      userWords.map((w) => w.lexeme_id),
    );
  }, [profile?.level_estimate, userWords]);

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
    if (!texts || !userWords) return [];

    const trackedCount = userWords.filter((w) => w.status === "known" || w.status === "learning").length;
    const knownCount = trackedCount + priorWordIds.length;
    let fallbackIds: string[] | undefined = undefined;

    if (knownCount < 40) {
      const level = levels.find((l) => l.id === profile?.level_estimate);
      if (level) {
        const inBand = lexicon.entries.filter((e) => level.freqBands.includes(e.freqBand));
        fallbackIds = inBand.slice(0, 60).map((e) => e.id);
      }
    }

    return selectUnread({
      texts,
      readIds,
      trackedIds: userWords
        .filter((w) => w.status === "known" || w.status === "learning")
        .map((w) => w.lexeme_id),
      priorIds: priorWordIds,
      fallbackIds,
      activeTextId,
    }) as typeof texts;
  }, [texts, readIds, userWords, activeTextId, priorWordIds, profile?.level_estimate]);

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
    // Counts rounds that ended with the pool still empty. The server writing a
    // text is not the same as the reader being able to show one - they measure
    // difficulty differently, one over running words and one over distinct
    // lexemes - and when they disagree the server reports success, nothing
    // errors, and the learner waits on "Writing your next text…" forever.
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
  const poolEmpty = !isLoading && !!readRows && unread.length === 0;
  // The count is bumped in the mutation's own callback and cleared by the two
  // events that mean "this run is over" - finishing a text, and Try again - so
  // it never needs to be written from an effect or read during render.
  const gaveUp = poolEmpty && !generate.isPending && emptyGenerations >= MAX_EMPTY_GENERATIONS;

  useEffect(() => {
    if (!poolEmpty || generate.isPending || generate.isError) return;
    if (emptyGenerations >= MAX_EMPTY_GENERATIONS) return;
    generate.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolEmpty, generate.isPending, generate.isError, emptyGenerations]);

  useEffect(() => {
    if (generate.isPending) {
      const timer = setTimeout(() => setShowRetry(true), 15000);
      return () => clearTimeout(timer);
    } else {
      setShowRetry(false);
    }
  }, [generate.isPending]);

  useEffect(() => {
    if (unread.length > 0) {
      const activeStillUnread = activeTextId != null && unread.some((t) => t.id === activeTextId);
      if (!activeStillUnread && unread[0].id !== activeTextId) {
        queueMicrotask(() => setActiveTextId(unread[0].id));
      }
    }
  }, [unread, activeTextId]);

  if (isLoading || !profile || !readRows || !userWords) {
    return <ReaderSkeleton />;
  }

  if (unread.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center py-32 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-lapis-soft text-lapis">
          <BookOpen size={24} />
        </div>
        {generate.isError || gaveUp ? (
          <>
            <h1 className="mt-6 text-[20px] font-semibold">Couldn&apos;t write a new text</h1>
            <p className="mx-auto mt-2 max-w-xs text-[14px] text-ink-soft">
              {generate.isError
                ? generate.error instanceof Error
                  ? generate.error.message
                  : "The AI writer is unavailable."
                : "We wrote a few and none were the right level for you. Marking a few more words as known usually fixes it."}
            </p>
            <Button
              className="mt-8"
              onClick={() => {
                setEmptyGenerations(0);
                generate.mutate();
              }}
            >
              Try again
            </Button>
          </>
        ) : (
          <>
            <h1 className="mt-6 text-[20px] font-semibold">Writing your next text…</h1>
            <p className="mt-2 text-[14px] text-ink-soft">
              A fresh story with just the right new words.
            </p>
            {showRetry && (
              <Button
                variant="outline"
                className="mt-8"
                onClick={() => {
                  setEmptyGenerations(0);
                  generate.mutate();
                }}
              >
                Taking too long? Try again
              </Button>
            )}
          </>
        )}
      </div>
    );
  }

  const current = unread[0];
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

