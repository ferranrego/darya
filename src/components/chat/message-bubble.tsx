"use client";

import { Languages, Loader2, Trash2, SpellCheck } from "lucide-react";
import { useState } from "react";
import { DARI_SCRIPT, type EnrichMode } from "@/lib/chat/shared";
import type { ChatMessageRow } from "@/lib/db/types";
import { useEnrichMessage, useDeleteMessage } from "@/lib/queries/use-chat";

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageBubble({
  message,
  own,
  showName,
  showTime,
  groupStart,
}: {
  message: ChatMessageRow;
  own: boolean;
  /** First message in a run from this sender: show their name above it. */
  showName: boolean;
  /** Last message in a run: show its timestamp below it. */
  showTime: boolean;
  /** First message in a run: space it apart from the group above. */
  groupStart: boolean;
}) {
  const [open, setOpen] = useState<EnrichMode | null>(null);
  const enrich = useEnrichMessage();
  const deleteMsg = useDeleteMessage();

  const isDari = DARI_SCRIPT.test(message.body);
  const pending = enrich.isPending && enrich.variables?.id === message.id;
  const shown = open ? message[open] : null;

  function toggle(mode: EnrichMode) {
    if (open === mode) return setOpen(null);
    setOpen(mode);
    if (!message[mode]) enrich.mutate({ id: message.id, mode });
  }

  const failed = enrich.isError && enrich.variables?.id === message.id && open && !shown;
  const showFooter = showTime || isDari;

  return (
    <div
      className={`flex flex-col gap-1 w-full ${
        groupStart ? "mt-3" : "mt-0.5"
      }`}
    >
      {showName && !own && (
        <span className="px-1 text-[13px] text-ink-soft">{message.display_name || "Anonymous"}</span>
      )}

      <div className={`flex w-full items-center gap-2 ${own ? "flex-row-reverse" : ""}`}>
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
            own ? "bg-lapis text-white" : "border border-line bg-surface text-ink"
          }`}
        >
          <p
            lang={isDari ? "prs" : undefined}
            dir="auto"
            className={`whitespace-pre-wrap text-[16px] leading-relaxed ${
              isDari ? "text-[19px] break-normal" : "break-words"
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
                  <p className="text-[16px]" dir="auto" lang="prs">
                    {(shown as { corrected: string }).corrected}
                  </p>
                  {((shown as { issues?: unknown[] }).issues || []).length === 0 ? (
                    <p className="italic text-[13px]">Looks good! No issues found.</p>
                  ) : (
                    <ul className="list-disc pl-4 text-[13px] flex flex-col gap-1">
                      {((shown as { issues?: Array<{ before: string; after: string; whyEn: string }> }).issues ?? []).map((issue, i: number) => (
                        <li key={i}>
                          <span className="line-through opacity-70" dir="auto" lang="prs">{issue.before}</span>
                          {" → "}
                          <span dir="auto" lang="prs">{issue.after}</span>
                          {": "}
                          {issue.whyEn}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <p dir="auto" className="italic">
                  {(shown as string) ?? (pending ? "Thinking..." : "Could not do that right now.")}
                </p>
              )}
            </div>
          )}
        </div>

        {own && (
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

          {isDari && (
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
                  aria-label="Check my Dari"
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
