"use client";

import { Send } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TutorThread } from "@/components/chat/tutor-thread";
import { Poncha } from "@/components/poncha";
import { SegmentedControl } from "@/components/profile/segmented-control";
import { MAX_MESSAGE_LENGTH, startsGroup } from "@/lib/chat/shared";
import { useUser } from "@/lib/queries/hooks";
import { useChatMessages, useSendMessage } from "@/lib/queries/use-chat";
import { useSendTutorMessage, useTutorMessages, TutorError } from "@/lib/queries/use-tutor";
import { useSettingsStore, type ChatMode } from "@/lib/settings-store";
import { profile as lang } from "@/lib/lang";

/**
 * Reasons the composer should close rather than invite another refused send.
 * Kept in step with `BLOCKING` in tutor-thread.tsx, which explains the choice.
 */
const BLOCKING: readonly string[] = ["busy", "limit"];

/**
 * Loaded on the first keystroke, not with the page.
 *
 * The hints resolve every token against the lexicon, and a static import put
 * the whole 3.56 MB lexicon chunk on the Chat tab before anyone had typed a
 * letter - most visits only read the room. An empty draft never has a hint
 * (`checkDraft` returns none below one token), so nothing is lost by not
 * mounting it until there is text.
 */
const DraftHints = dynamic(
  () => import("@/components/chat/draft-hints").then((m) => m.DraftHints),
  { ssr: false },
);

export default function ChatPage() {
  const { data: user } = useUser();
  const mode = useSettingsStore((s) => s.chatMode);
  const setMode = useSettingsStore((s) => s.setChatMode);

  const room = useChatMessages();
  const sendToRoom = useSendMessage();
  const tutor = useTutorMessages();
  const sendToTutor = useSendTutorMessage();

  const [draft, setDraft] = useState("");
  // Latched rather than `draft !== ""`: once mounted the hints stay mounted, so
  // clearing the draft on send still plays their exit animation. Adjusted during
  // render, React's pattern for state derived from a changed value.
  const [hintsWanted, setHintsWanted] = useState(false);
  if (draft !== "" && !hintsWanted) setHintsWanted(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  /**
   * `/chat?ask=…` arrives from the Grammar Hub's "Ask the tutor" button with
   * the learner's question already written.
   *
   * It always opens the *tutor*, never the room: the room is one public thread
   * for every learner, and a grammar question typed for a private explanation
   * must not be one tap from being posted there. It only fills the draft - the
   * learner still decides to send, because each send spends the free-tier
   * quota every learner shares. The parameter is then dropped from the URL so
   * a reload or a back-navigation does not refill a draft already sent.
   *
   * Read from `window.location` in an effect rather than `useSearchParams`,
   * which would break this page's static prerender (see CLAUDE.md).
   */
  useEffect(() => {
    const url = new URL(window.location.href);
    const ask = url.searchParams.get("ask")?.trim();
    if (!ask) return;
    url.searchParams.delete("ask");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    // Deferred like the word sheet's reset: this syncs from the URL, an
    // external source, once on arrival.
    setTimeout(() => {
      setMode("tutor");
      setDraft(ask.slice(0, MAX_MESSAGE_LENGTH));
    }, 0);
  }, [setMode]);

  useEffect(() => {
    if (mode === "room") bottomRef.current?.scrollIntoView({ block: "end" });
  }, [room.data?.length, mode]);

  const isTutor = mode === "tutor";
  const sending = isTutor ? sendToTutor.isPending : sendToRoom.isPending;
  const failure =
    isTutor && sendToTutor.error instanceof TutorError ? sendToTutor.error.reason : null;
  const blocked = failure !== null && BLOCKING.includes(failure);

  function send(text: string) {
    const body = text.trim();
    if (!body || sending || blocked) return;
    setDraft("");
    if (isTutor) {
      sendToTutor.mutate(body, { onError: () => setDraft(body) });
    } else {
      sendToRoom.mutate(body, { onError: () => setDraft(body) });
    }
  }

  function switchMode(next: ChatMode) {
    setMode(next);
    // The draft belongs to the conversation it was written for; carrying it
    // across is how a message meant for one thread lands in the other.
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="pt-2">
        <h1 className="text-[28px] font-semibold tracking-tight">Chat</h1>
        <p className="mt-1 text-[15px] text-ink-soft">
          {isTutor
            ? `Practise ${lang.name} with ${lang.brand.mascotName}, any time.`
            : "One room for every learner. Messages disappear after 48 hours."}
        </p>
      </header>

      <SegmentedControl<ChatMode>
        value={mode}
        onChange={switchMode}
        options={[
          { value: "room", label: "Room" },
          { value: "tutor", label: lang.brand.mascotName },
        ]}
      />

      {isTutor ? (
        <TutorThread
          messages={tutor.data}
          isLoading={tutor.isLoading}
          isPending={sendToTutor.isPending}
          error={sendToTutor.error}
          onStarter={send}
          onRetry={() => sendToTutor.reset()}
        />
      ) : room.isLoading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`h-14 rounded-2xl bg-surface/60 ${i % 2 ? "w-2/3" : "ml-auto w-1/2"}`}
            />
          ))}
        </div>
      ) : room.data && room.data.length > 0 ? (
        <div className="flex flex-col pb-20">
          {room.data.map((m, i) => {
            const isGroupStart = startsGroup(m, room.data![i - 1]);
            const isGroupEnd = !room.data![i + 1] || startsGroup(room.data![i + 1], m);
            return (
              <MessageBubble
                key={m.id}
                message={m}
                own={m.user_id === user?.id}
                displayName={m.display_name}
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
              lang={lang.code}
              dir={lang.dir}
              className="absolute -right-3 -top-2 rounded-2xl rounded-br-sm border border-line bg-paper px-3 py-1 text-[20px] text-lapis shadow-[0_2px_8px_rgba(31,26,23,0.06)]"
            >
              {lang.samples.greeting.target}
            </span>
            <Poncha pose="greet" size={150} />
          </div>
          <p className="mt-3 text-[15px] text-ink-soft">
            Nobody has written yet. Say salaam! Nothing here lasts more than 48 hours, so write
            freely, in {lang.name}, Latin letters, or English.
          </p>
        </div>
      )}

      {/* Sits above the tab bar, which paints over the padding below. Anchored
          to the app shell (`absolute`, containing block outside #app-scroll)
          rather than `fixed`, which iOS standalone PWAs misplace. */}
      <div className="absolute inset-x-0 bottom-0 z-30 border-t border-line/70 bg-paper/90 pb-[calc(var(--tab-bar-h)+10px)] pt-3 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-2xl px-5">
          {/* The tutor thread renders its own error inline, next to the retry,
              so only the room needs a line here. */}
          {!isTutor && sendToRoom.isError && (
            <p className="mb-2 text-[13px] text-danger">
              {sendToRoom.error instanceof Error ? sendToRoom.error.message : "Could not send that."}
            </p>
          )}

          {/* Free, instant, provider-free. Shown in both threads: the room is
              somewhere learners write the target language too. */}
          {hintsWanted && <DraftHints draft={draft} />}

          <div className="flex items-end gap-2">
            <textarea
              dir="auto"
              rows={1}
              value={draft}
              disabled={blocked}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={
                blocked
                  ? `${lang.brand.mascotName} is taking a break`
                  : isTutor
                    ? `Write to ${lang.brand.mascotName}...`
                    : "Write something..."
              }
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              className="max-h-32 min-h-11 w-full resize-none rounded-2xl border border-line bg-surface px-4 py-2.5 text-[15px] text-ink transition-colors placeholder:text-ink-faint focus:border-lapis focus:outline-none disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => send(draft)}
              disabled={!draft.trim() || sending || blocked}
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
