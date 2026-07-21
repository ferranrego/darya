/** Bits the chat UI and the enrichment API both need. No server-only imports. */

export type EnrichMode = "translit" | "translation";

/** Dari is written in Arabic script; Latin-only messages need no help. */
export const DARI_SCRIPT = /[؀-ۿ]/;

export const MAX_MESSAGE_LENGTH = 500;

/** A pause longer than this splits a sender's messages into a new group. */
export const GROUP_GAP_MS = 15 * 60 * 1000;

interface Groupable {
  user_id: string;
  created_at: string;
}

/**
 * True when `m` opens a new visual group: a different sender, or the same
 * sender picking the conversation back up after a long pause. A message ends
 * a group when there is no next message, or the next one starts a group.
 */
export function startsGroup(m: Groupable, prev?: Groupable): boolean {
  if (!prev) return true;
  if (prev.user_id !== m.user_id) return true;
  const gap = new Date(m.created_at).getTime() - new Date(prev.created_at).getTime();
  return gap > GROUP_GAP_MS;
}
