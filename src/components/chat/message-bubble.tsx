"use client";

import { Languages, Loader2 } from "lucide-react";
import { useState } from "react";
import { DARI_SCRIPT, type EnrichMode } from "@/lib/chat/shared";
import type { ChatMessageRow } from "@/lib/db/types";
import { useEnrichMessage } from "@/lib/queries/use-chat";

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
      className={`flex flex-col gap-1 ${own ? "items-end" : "items-start"} ${
        groupStart ? "mt-3" : "mt-0.5"
      }`}
    >
      {showName && !own && (
        <span className="px-1 text-[13px] text-ink-soft">{message.display_name || "Anonymous"}</span>
      )}

      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          own ? "bg-lapis text-white" : "border border-line bg-surface text-ink"
        }`}
      >
        <p
          {...(isDari ? { lang: "prs" } : { dir: "auto" })}
          className={`whitespace-pre-wrap break-words text-[16px] leading-relaxed ${
            isDari ? "text-[19px]" : ""
          }`}
        >
          {message.body}
        </p>

        {(shown || pending || failed) && (
          <p
            dir="auto"
            className={`mt-2 border-t pt-2 text-[14px] italic ${
              own ? "border-white/25 text-white/80" : "border-line text-ink-soft"
            }`}
          >
            {shown ?? (pending ? "Thinking..." : "Could not do that right now.")}
          </p>
        )}
      </div>

      {showFooter && (
        <div className={`flex items-center gap-2 px-1 ${own ? "flex-row-reverse" : ""}`}>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
