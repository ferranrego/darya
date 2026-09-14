"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAlphabetProgress } from "../db/alphabet";
import { getHistoryActivity } from "../db/activity";
import { stickingPoints } from "../db/errors";
import { getGrammarProgress } from "../db/grammar";
import { getProfile } from "../db/profiles";
import { getReadTexts, getReadTextsWithDocs, getText, getTextsForLevel } from "../db/texts";
import { getUserWords, getWordCounts } from "../db/words";
import { asLexiconEntry, getUserLexemes } from "../db/user-lexemes";
import { getImport, getImports } from "../db/imports";
import type { LexiconEntry } from "../content/schema";
import type { WordStatus } from "../db/types";
import { supabaseBrowser } from "../supabase/client";
import { buildIndex } from "../text";
import type { LexiconIndex } from "../lang/types";

export function useSupabase() {
  return useMemo(() => supabaseBrowser(), []);
}

export function useUser() {
  const db = useSupabase();
  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const { data, error } = await db.auth.getUser();
      if (error) throw error;
      return data.user;
    },
  });
}

export function useProfile() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: () => getProfile(db, user!.id),
  });
}

export function useUserWords() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["user_words", user?.id],
    enabled: !!user,
    queryFn: () => getUserWords(db, user!.id),
  });
}

/**
 * The words this learner keeps getting wrong and has not yet got right again.
 *
 * Until now every mistake the app saw was discarded, so it could not do the one
 * thing a teacher does without thinking: notice what this person keeps losing.
 * This is the read side of that record, and the only one a learner sees.
 */
export function useStickingPoints() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["sticking_points", user?.id],
    enabled: !!user,
    queryFn: () => stickingPoints(db, user!.id),
  });
}

/** lexeme_id → status, for fast token colouring while reading. */
export function useWordStatusMap(): Map<string, WordStatus> | undefined {
  const { data } = useUserWords();
  return useMemo(() => {
    if (!data) return undefined;
    return new Map(data.map((w) => [w.lexeme_id, w.status]));
  }, [data]);
}

/**
 * The learner's personal dictionary - words glossed from imported articles.
 *
 * Kept separate from the shipped lexicon, which is a static import: these rows
 * are per-user, arrive at runtime, and must never shadow curated content.
 */
export function useUserLexemes() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["user_lexemes", user?.id],
    enabled: !!user,
    queryFn: () => getUserLexemes(db, user!.id),
  });
}

/** ux- id → entry, for rendering a personal word anywhere a lexicon word renders. */
export function usePersonalLexemeMap(): Map<string, LexiconEntry> | undefined {
  const { data } = useUserLexemes();
  return useMemo(() => {
    if (!data) return undefined;
    return new Map(data.map((row) => [row.id, asLexiconEntry(row)]));
  }, [data]);
}

/**
 * The personal dictionary as a resolving index.
 *
 * Built with the same `buildIndex` the shipped lexicon uses, which is the whole
 * point of storing personal words in LexiconEntry shape: a glossed Catalan verb
 * resolves its conjugations and a glossed Dari noun its plural, with no code
 * that knows these entries are personal. Consulted only after the lexicon, so a
 * model's guess can never shadow curated content.
 */
export function usePersonalIndex(): LexiconIndex | undefined {
  const { data } = useUserLexemes();
  return useMemo(() => {
    if (!data) return undefined;
    return buildIndex(data.map(asLexiconEntry));
  }, [data]);
}

export function useImports() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["imported_texts", user?.id],
    enabled: !!user,
    queryFn: () => getImports(db, user!.id),
  });
}

export function useImport(id: string | undefined) {
  const db = useSupabase();
  return useQuery({
    queryKey: ["imported_text", id],
    enabled: !!id,
    queryFn: () => getImport(db, id!),
  });
}

/**
 * Known, learning and due counts, as integers from the database.
 *
 * For everything that only needs a number - the Review badge, Home, Stats,
 * Profile and the milestone observer. Pages that need the rows themselves
 * (review, the reader, the word list) still use `useUserWords`.
 *
 * The key extends `["user_words", id]` on purpose: every existing
 * `invalidateQueries({ queryKey: ["user_words"] })` is a prefix match, so a
 * learning action refreshes the counts too and no call site can forget to.
 *
 * Refetched every minute so the badge appears as words come due, without a
 * reload. It used to tick a local clock over the full row set instead; the
 * refetch pauses while offline, which is when there is nothing to review
 * against the server anyway.
 */
export function useWordCounts() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["user_words", user?.id, "counts"],
    enabled: !!user,
    queryFn: () => getWordCounts(db, user!.id, new Date()),
    refetchInterval: 60_000,
  });
}

/** How many learning words are due right now. See `useWordCounts`. */
export function useDueCount(): number {
  return useWordCounts().data?.due ?? 0;
}

export function useTextsForLevel(level: string | undefined) {
  const db = useSupabase();
  return useQuery({
    queryKey: ["texts", level],
    enabled: !!level,
    queryFn: () => getTextsForLevel(db, level!),
  });
}

export function useText(id: string | undefined) {
  const db = useSupabase();
  return useQuery({
    queryKey: ["text", id],
    enabled: !!id,
    queryFn: () => getText(db, id!),
  });
}

export function useReadTexts() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["user_texts", user?.id],
    enabled: !!user,
    queryFn: () => getReadTexts(db, user!.id),
  });
}

/**
 * Every text this learner has read, with its full document.
 *
 * `enabled` lets a caller defer it: the reader only needs these documents to
 * offer a re-read when nothing new is waiting, and fetching them on every
 * visit downloaded the learner's entire reading history - a list that only
 * grows - to render a text that was usually already chosen.
 */
export function useReadTextsWithDocs({ enabled = true }: { enabled?: boolean } = {}) {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["user_texts_docs", user?.id],
    enabled: !!user && enabled,
    queryFn: () => getReadTextsWithDocs(db, user!.id),
  });
}

export function useAlphabetProgress() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["alphabet_progress", user?.id],
    enabled: !!user,
    queryFn: () => getAlphabetProgress(db, user!.id),
  });
}

export function useGrammarProgress() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["grammar_progress", user?.id],
    enabled: !!user,
    queryFn: () => getGrammarProgress(db, user!.id),
  });
}

/** Invalidate the per-user caches that change after any learning action. */
export function useInvalidateLearning() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["profile"] }),
      qc.invalidateQueries({ queryKey: ["user_words"] }),
      qc.invalidateQueries({ queryKey: ["user_lexemes"] }),
      qc.invalidateQueries({ queryKey: ["user_texts"] }),
      qc.invalidateQueries({ queryKey: ["alphabet_progress"] }),
      qc.invalidateQueries({ queryKey: ["grammar_progress"] }),
      qc.invalidateQueries({ queryKey: ["activity"] }),
      qc.invalidateQueries({ queryKey: ["activity_history"] }),
    ]);
}

export function useActivityHistory() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["activity_history", user?.id],
    enabled: !!user,
    queryFn: () => getHistoryActivity(db, user!.id),
  });
}

export function useSignOut() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await db.auth.signOut();
      qc.clear();
      await purgeCachedPages();
    },
  });
}

/**
 * Delete the service worker's cached pages on sign-out.
 *
 * Signed-in pages carry the learner's session in their markup (the `(app)`
 * layout seeds the user and profile into the client cache), and the service
 * worker keeps the last copy of each page for offline use. Without this, the
 * next person to open the app offline on a shared device would be served the
 * previous learner's pages. Static assets are not personal and stay cached.
 *
 * Matches the `${VERSION}-pages` naming in public/sw.js. Best effort: a
 * browser without Cache Storage has nothing to purge.
 */
async function purgeCachedPages(): Promise<void> {
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(names.filter((n) => n.endsWith("-pages")).map((n) => caches.delete(n)));
  } catch {
    // Storage can be unavailable (private mode, quota); sign-out still succeeds.
  }
}
