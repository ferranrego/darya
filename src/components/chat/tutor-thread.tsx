"use client";

import { AnimatePresence, motion } from "motion/react";
import { RefreshCw } from "lucide-react";
import { useEffect, useRef } from "react";
import { MessageBubble } from "@/components/chat/message-bubble";
import { TypingDots } from "@/components/chat/typing-dots";
import { Poncha } from "@/components/poncha";
import { Button } from "@/components/ui/button";
import { profile as lang } from "@/lib/lang";
import type { TutorMessageRow } from "@/lib/db/types";
import { TutorError } from "@/lib/queries/use-tutor";

/**
 * Reasons that mean sending again right now cannot work.
 *
 * For everything else the composer stays live and the learner can retry, which
 * is usually the right thing - a single timeout often clears. But when the
 * shared provider quota is spent, or they have hit their own daily cap, an
 * enabled composer invites them to type into a void and be refused again. So
 * these two states close it and say why.
 */
const BLOCKING: readonly string[] = ["busy", "limit"];

export function TutorThread({
  messages,
  isLoading,
  isPending,
  error,
  onStarter,
  onRetry,
}: {
  messages: TutorMessageRow[] | undefined;
  isLoading: boolean;
  isPending: boolean;
  error: unknown;
  onStarter: (text: string) => void;
  onRetry: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages?.length, isPending]);

  const reason = error instanceof TutorError ? error.reason : error ? "failed" : null;
  const message =
    error instanceof TutorError
      ? error.message
      : error
        ? `${lang.brand.mascotName} couldn't reply just now. Try again in a moment.`
        : null;

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-14 rounded-2xl bg-surface/60 ${i % 2 ? "w-2/3" : "ml-auto w-1/2"}`}
          />
        ))}
      </div>
    );
  }

  const empty = !messages || messages.length === 0;

  return (
    <div className="flex flex-col pb-20">
      {empty && !isPending ? (
        <Starters onPick={onStarter} />
      ) : (
        messages?.map((m, i) => {
          const own = m.role === "user";
          const prev = messages[i - 1];
          const next = messages[i + 1];
          return (
            <MessageBubble
              key={m.id}
              message={m}
              own={own}
              source="tutor"
              showName={false}
              showTime={!next || next.role !== m.role}
              groupStart={!prev || prev.role !== m.role}
            />
          );
        })
      )}

      <AnimatePresence>
        {isPending && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 w-fit rounded-2xl border border-line bg-surface px-4 py-3.5"
          >
            <TypingDots />
          </motion.div>
        )}
      </AnimatePresence>

      {reason && (
        <div className="mt-4 rounded-2xl border border-line bg-surface p-4">
          <p className="text-[14px] text-ink-soft">{message}</p>
          {!BLOCKING.includes(reason) && (
            <Button variant="secondary" onClick={onRetry} className="mt-3">
              <RefreshCw size={15} />
              Try again
            </Button>
          )}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

/**
 * Openers for a blank thread.
 *
 * A learner who has never had a conversation in the language does not know what
 * to say first, and an empty composer is where they leave. These are written
 * out in the target language so tapping one is itself the first thing they
 * "said" - not an English prompt that gets translated for them.
 */
function Starters({ onPick }: { onPick: (text: string) => void }) {
  return (
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
        Chat with {lang.brand.mascotName} in {lang.name}. Tap any message to see it in Latin
        letters, translate it, or have your own {lang.name} checked.
      </p>

      <div className="mt-4 flex w-full flex-col gap-2">
        {lang.samples.starters.map((s) => (
          <button
            key={s.target}
            type="button"
            onClick={() => onPick(s.target)}
            className="flex flex-col gap-0.5 rounded-2xl border border-line bg-paper px-4 py-2.5 text-start transition-colors active:scale-[0.99] hover:border-lapis"
          >
            <span lang={lang.code} dir={lang.dir} className="text-[18px] text-ink">
              {s.target}
            </span>
            <span className="text-[13px] text-ink-faint">{s.en}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
