"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listTutorMessages } from "../db/tutor";
import type { TutorMessageRow } from "../db/types";
import { useSupabase, useUser } from "./hooks";

const KEY = ["tutor_messages"] as const;

/**
 * Why a send failed, carried alongside the message so the UI can decide
 * whether the composer should stay usable. Mirrors `TutorFailure` on the
 * server; a string the client does not recognise degrades to a plain retry.
 */
export class TutorError extends Error {
  constructor(
    message: string,
    readonly reason: string,
  ) {
    super(message);
    this.name = "TutorError";
  }
}

/**
 * The learner's own thread. No Realtime subscription: there is one participant
 * and one device, and the send mutation already appends both rows.
 */
export function useTutorMessages() {
  const db = useSupabase();
  const { data: user } = useUser();

  return useQuery({
    queryKey: KEY,
    enabled: !!user,
    queryFn: () => listTutorMessages(db),
  });
}

function append(
  qc: ReturnType<typeof useQueryClient>,
  ...rows: (TutorMessageRow | undefined)[]
) {
  qc.setQueryData<TutorMessageRow[]>(KEY, (old) => {
    const next = [...(old ?? [])];
    for (const row of rows) {
      if (row && !next.some((m) => m.id === row.id)) next.push(row);
    }
    return next;
  });
}

export function useSendTutorMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: string) => {
      const res = await fetch("/api/tutor/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        // The route stores the learner's turn before it calls the provider, so
        // a failure past that point still returns it. Keeping it in the thread
        // means a provider outage does not eat what they wrote.
        if (json.userMessage) append(qc, json.userMessage as TutorMessageRow);
        throw new TutorError(json.error ?? "Could not send that.", json.reason ?? "failed");
      }
      return json as { userMessage: TutorMessageRow; tutorMessage: TutorMessageRow };
    },
    onSuccess: ({ userMessage, tutorMessage }) => append(qc, userMessage, tutorMessage),
  });
}
