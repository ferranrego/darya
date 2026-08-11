"use client";

import { Languages, Loader2, Trash2, SpellCheck } from "lucide-react";
import { useState } from "react";
import { looksLikeTarget, type EnrichMode } from "@/lib/chat/shared";
import type { ChatMessageRow, TutorMessageRow } from "@/lib/db/types";
import { useEnrichMessage, useDeleteMessage, type EnrichSource } from "@/lib/queries/use-chat";
import { profile as lang } from "@/lib/lang";
import { TypingDots } from "./typing-dots";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * What this bubble needs from a row. Both threads store the same four columns,
 * which is what lets one component (and one set of tool buttons) serve the
 * community room and the tutor thread.
 */
type EnrichableMessage = Pick<
  ChatMessageRow & TutorMessageRow,
  "id" | "body" | "translit" | "translation" | "correction" | "created_at"
>;

export function MessageBubble({
  message,
  own,
  showName,
  showTime,
  groupStart,
  source = "room",
  displayName,
  canDelete = own && source === "room",
}: {
  message: EnrichableMessage;
  own: boolean;
  /** First message in a run from this sender: show their name above it. */
  showName: boolean;
  /** Last message in a run: show its timestamp below it. */
  showTime: boolean;
  /** First message in a run: space it apart from the group above. */
  groupStart: boolean;
  /** Which thread this row lives in; picks the table server-side. */
  source?: EnrichSource;
  /** Sender's name, for the room. The tutor thread has only two participants. */
  displayName?: string;
  /** The tutor thread is server-written, so nothing in it can be deleted. */
  canDelete?: boolean;
}) {
  const [open, setOpen] = useState<EnrichMode | null>(null);
  const enrich = useEnrichMessage();
  const deleteMsg = useDeleteMessage();

  const isTarget = looksLikeTarget(message.body);
  const pending = enrich.isPending && enrich.variables?.id === message.id;
  const shown = open ? message[open] : null;

  function toggle(mode: EnrichMode) {
    if (open === mode) return setOpen(null);
    setOpen(mode);
    if (!message[mode]) enrich.mutate({ id: message.id, mode, source });
  }

  const failed = enrich.isError && enrich.variables?.id === message.id && open && !shown;
  const showFooter = showTime || isTarget;

  return (
    <div
      className={`flex flex-col gap-1 w-full ${
        groupStart ? "mt-3" : "mt-0.5"
      }`}
    >
      {showName && !own && displayName !== undefined && (
        <span className="px-1 text-[13px] text-ink-soft">{displayName || "Anonymous"}</span>
      )}

      <div className={`flex w-full items-center gap-2 ${own ? "flex-row-reverse" : ""}`}>
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
            own ? "bg-lapis text-white" : "border border-line bg-surface text-ink"
          }`}
        >
          <p
            // `lang.code`, not a hardcoded "prs": the CSS rule that applies the
            // target font and direction keys off any non-English `lang`, so a
            // literal here rendered Catalan messages right-to-left in Vazirmatn.
            lang={isTarget ? lang.code : undefined}
            dir="auto"
            className={`whitespace-pre-wrap text-[16px] leading-relaxed ${
              isTarget ? "text-[19px] break-normal" : "break-words"
            }`}
          >
            {message.body}
          </p>

          {(shown || pending || failed) && (
            <div
              className={`mt-2 border-t pt-2 text-[14px] ${
                own ? "border-white/25 text-white/80" : "border-line text-ink-soft"
              }`}
            >
              {open === "correction" && shown ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[16px]" dir="auto" lang={lang.code}>
                    {(shown as { corrected: string }).corrected}
                  </p>
                  {((shown as { issues?: unknown[] }).issues || []).length === 0 ? (
                    <p className="italic text-[13px]">Looks good! No issues found.</p>
                  ) : (
                    <ul className="list-disc pl-4 text-[13px] flex flex-col gap-1">
                      {((shown as { issues?: Array<{ before: string; after: string; whyEn: string }> }).issues ?? []).map((issue, i: number) => (
                        <li key={i}>
                          <span className="line-through opacity-70" dir="auto" lang={lang.code}>{issue.before}</span>
                          {" → "}
                          <span dir="auto" lang={lang.code}>{issue.after}</span>
                          {": "}
                          {issue.whyEn}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : shown ? (
                <p dir="auto" className="italic">
                  {shown as string}
                </p>
              ) : pending ? (
                <TypingDots label="Working on it…" />
              ) : (
                <p dir="auto" className="italic">
                  Could not do that right now.
                </p>
              )}
            </div>
          )}
        </div>

        {canDelete && (
          <button
            type="button"
            onClick={() => deleteMsg.mutate(message.id)}
            disabled={deleteMsg.isPending}
            className="shrink-0 p-1.5 text-ink-faint/60 transition-colors hover:text-danger active:scale-95"
            aria-label="Delete message"
          >
            {deleteMsg.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Trash2 size={15} />
            )}
          </button>
        )}
      </div>

      {showFooter && (
        <div className={`flex w-full items-center gap-2 px-1 ${own ? "flex-row-reverse" : ""}`}>
          {showTime && (
            <span className="text-[11px] text-ink-faint">{timeOf(message.created_at)}</span>
          )}

          {isTarget && (
            <>
              <button
                type="button"
                onClick={() => toggle("translit")}
                aria-pressed={open === "translit"}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors ${
                  open === "translit" ? "bg-lapis-soft text-lapis" : "text-ink-faint hover:text-lapis"
                }`}
              >
                {pending && open === "translit" ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  "abc"
                )}
              </button>
              <button
                type="button"
                onClick={() => toggle("translation")}
                aria-label="Translate to English"
                aria-pressed={open === "translation"}
                className={`rounded-full p-1 transition-colors ${
                  open === "translation"
                    ? "bg-lapis-soft text-lapis"
                    : "text-ink-faint hover:text-lapis"
                }`}
              >
                {pending && open === "translation" ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Languages size={13} />
                )}
              </button>
              {own && (
                <button
                  type="button"
                  onClick={() => toggle("correction")}
                  aria-label={`Check my ${lang.name}`}
                  aria-pressed={open === "correction"}
                  className={`rounded-full p-1 transition-colors ${
                    open === "correction"
                      ? "bg-lapis-soft text-lapis"
                      : "text-ink-faint hover:text-lapis"
                  }`}
                >
                  {pending && open === "correction" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <SpellCheck size={13} />
                  )}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
