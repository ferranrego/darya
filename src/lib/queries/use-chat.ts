"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { deleteMessage, listRecentMessages, sendMessage } from "../db/chat";
import type { ChatMessageRow } from "../db/types";
import type { EnrichMode } from "../chat/shared";
import { useSupabase, useUser } from "./hooks";

const KEY = ["chat_messages"] as const;

/**
 * The room's messages, kept live by a Realtime subscription that lasts only
 * as long as the chat page is mounted.
 */
export function useChatMessages() {
  const db = useSupabase();
  const qc = useQueryClient();
  const { data: user } = useUser();

  const query = useQuery({
    queryKey: KEY,
    enabled: !!user,
    queryFn: () => listRecentMessages(db),
  });

  useEffect(() => {
    if (!user) return;

    const upsert = (row: ChatMessageRow) => {
      qc.setQueryData<ChatMessageRow[]>(KEY, (old) => {
        if (!old) return old;
        const i = old.findIndex((m) => m.id === row.id);
        if (i === -1) return [...old, row];
        const next = [...old];
        next[i] = row;
        return next;
      });
    };

    const channel = db
      .channel("chat")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        (payload) => upsert(payload.new as ChatMessageRow),
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "chat_messages" },
        (payload) => {
          qc.setQueryData<ChatMessageRow[]>(KEY, (old) =>
            old ? old.filter((m) => m.id !== payload.old.id) : old
          );
        },
      )
      // Enrichment fills translit/translation, so every reader gets the
      // cached result without asking for it again.
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages" },
        (payload) => upsert(payload.new as ChatMessageRow),
      )
      .subscribe();

    return () => {
      db.removeChannel(channel);
    };
  }, [db, qc, user]);

  return query;
}

export function useSendMessage() {
  const db = useSupabase();
  const qc = useQueryClient();
  const { data: user } = useUser();

  return useMutation({
    mutationFn: (body: string) => sendMessage(db, user!.id, body),
    onSuccess: (row) => {
      qc.setQueryData<ChatMessageRow[]>(KEY, (old) =>
        !old || old.some((m) => m.id === row.id) ? old : [...old, row],
      );
    },
  });
}

export function useDeleteMessage() {
  const db = useSupabase();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteMessage(db, id),
    onSuccess: (_, id) => {
      qc.setQueryData<ChatMessageRow[]>(KEY, (old) =>
        old ? old.filter((m) => m.id !== id) : old
      );
    },
  });
}

/** Which thread a message belongs to. Selects the table server-side. */
export type EnrichSource = "room" | "tutor";

const SOURCE_KEY: Record<EnrichSource, readonly string[]> = {
  room: KEY,
  tutor: ["tutor_messages"],
};

export function useEnrichMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      mode,
      source = "room",
    }: {
      id: string;
      mode: EnrichMode;
      source?: EnrichSource;
    }) => {
      const res = await fetch("/api/chat/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, mode, source }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "enrichment failed");
      return { id, mode, source, value: json.value as string };
    },
    onSuccess: ({ id, mode, source, value }) => {
      // Both threads cache the result on the row itself, so the write is the
      // same shape; only the query key differs.
      qc.setQueryData<{ id: string }[]>(SOURCE_KEY[source], (old) =>
        old?.map((m) => (m.id === id ? { ...m, [mode]: value } : m)),
      );
    },
  });
}
