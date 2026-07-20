"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { getAlphabetProgress } from "../db/alphabet";
import { getProfile } from "../db/profiles";
import { getReadTexts, getTextsForLevel } from "../db/texts";
import { getUserWords } from "../db/words";
import type { WordStatus } from "../db/types";
import { supabaseBrowser } from "../supabase/client";

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

/** lexeme_id → status, for fast token colouring while reading. */
export function useWordStatusMap(): Map<string, WordStatus> | undefined {
  const { data } = useUserWords();
  return useMemo(() => {
    if (!data) return undefined;
    return new Map(data.map((w) => [w.lexeme_id, w.status]));
  }, [data]);
}

export function useTextsForLevel(level: string | undefined) {
  const db = useSupabase();
  return useQuery({
    queryKey: ["texts", level],
    enabled: !!level,
    queryFn: () => getTextsForLevel(db, level!),
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

export function useAlphabetProgress() {
  const db = useSupabase();
  const { data: user } = useUser();
  return useQuery({
    queryKey: ["alphabet_progress", user?.id],
    enabled: !!user,
    queryFn: () => getAlphabetProgress(db, user!.id),
  });
}

/** Invalidate the per-user caches that change after any learning action. */
export function useInvalidateLearning() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["profile"] }),
      qc.invalidateQueries({ queryKey: ["user_words"] }),
      qc.invalidateQueries({ queryKey: ["user_texts"] }),
      qc.invalidateQueries({ queryKey: ["alphabet_progress"] }),
      qc.invalidateQueries({ queryKey: ["activity"] }),
    ]);
}

export function useSignOut() {
  const db = useSupabase();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await db.auth.signOut();
      qc.clear();
    },
  });
}
