import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessageRow } from "./types";

/** Messages older than this are invisible, and dropped hourly by pg_cron. */
export const CHAT_WINDOW_MS = 48 * 60 * 60 * 1000;

/** Oldest first, so the newest message renders at the bottom of the list. */
export async function listRecentMessages(
  db: SupabaseClient,
  limit = 200,
): Promise<ChatMessageRow[]> {
  const { data, error } = await db
    .from("chat_messages")
    .select("*")
    .gte("created_at", new Date(Date.now() - CHAT_WINDOW_MS).toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as ChatMessageRow[]).reverse();
}

/** Returns the inserted row so the sender renders without awaiting the echo. */
export async function sendMessage(
  db: SupabaseClient,
  userId: string,
  body: string,
): Promise<ChatMessageRow> {
  const { data, error } = await db
    .from("chat_messages")
    .insert({ user_id: userId, body: body.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as ChatMessageRow;
}
