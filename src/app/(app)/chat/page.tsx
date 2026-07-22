"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Poncha } from "@/components/poncha";
import { MAX_MESSAGE_LENGTH, startsGroup } from "@/lib/chat/shared";
import { useUser } from "@/lib/queries/hooks";
import { useChatMessages, useSendMessage } from "@/lib/queries/use-chat";

export default function ChatPage() {
  const { data: user } = useUser();
  const { data: messages, isLoading } = useChatMessages();
  const send = useSendMessage();

  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length]);

  function submit() {
    const body = draft.trim();
    if (!body || send.isPending) return;
    setDraft("");
    send.mutate(body, { onError: () => setDraft(body) });
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Chat</h1>
        <p className="mt-1 text-[15px] text-ink-soft">
          One room for every learner. Messages disappear after 48 hours.
        </p>
      </header>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`h-14 rounded-2xl bg-surface/60 ${i % 2 ? "w-2/3" : "ml-auto w-1/2"}`} />
          ))}
        </div>
      ) : messages && messages.length > 0 ? (
        <div className="flex flex-col pb-20">
          {messages.map((m, i) => {
            const isGroupStart = startsGroup(m, messages[i - 1]);
            const isGroupEnd = !messages[i + 1] || startsGroup(messages[i + 1], m);
            return (
              <MessageBubble
                key={m.id}
                message={m}
                own={m.user_id === user?.id}
                showName={isGroupStart}
                showTime={isGroupEnd}
                groupStart={isGroupStart}
              />
            );
          })}
          <div ref={bottomRef} />
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-line bg-surface p-6 text-center">
          <div className="relative">
            <span
              lang="prs"
              dir="rtl"
              className="absolute -right-3 -top-2 rounded-2xl rounded-br-sm border border-line bg-paper px-3 py-1 text-[20px] text-lapis shadow-[0_2px_8px_rgba(31,26,23,0.06)]"
            >
              سلام
            </span>
            <Poncha pose="greet" size={150} />
          </div>
          <p className="mt-3 text-[15px] text-ink-soft">
            Nobody has written yet. Say salaam! Nothing here lasts more than 48 hours, so write
            freely, in Dari script, Latin letters, or English.
          </p>
        </div>
      )}

      {/* Sits above the tab bar, which paints over the padding below. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line/70 bg-paper/90 pb-[calc(var(--tab-bar-h)+10px)] pt-3 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-2xl px-5">
          {send.isError && (
            <p className="mb-2 text-[13px] text-danger">
              {send.error instanceof Error ? send.error.message : "Could not send that."}
            </p>
          )}
          <div className="flex items-end gap-2">
            <textarea
              dir="auto"
              rows={1}
              value={draft}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder="Write something..."
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              className="max-h-32 min-h-11 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] text-ink transition-colors placeholder:text-ink-faint focus:border-lapis focus:outline-none"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim() || send.isPending}
              aria-label="Send message"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-lapis text-white transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
