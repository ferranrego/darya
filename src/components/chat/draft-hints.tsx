"use client";

import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";
import { looksLikeTarget } from "@/lib/chat/shared";
import { profile as lang } from "@/lib/lang";
import { checkDraft } from "@/lib/text/live-check";

/**
 * What the app can tell the learner about their draft for free.
 *
 * Runs on every keystroke and never calls a provider - see `live-check.ts`.
 * The deal this strikes with the learner is that it is *quiet*: muted colours,
 * no red, no count badge, and it disappears the moment the draft is clean.
 * Anything louder would be interrupting them mid-sentence, which is the one
 * thing the conversation feature is designed not to do.
 *
 * The remaining mistakes - agreement, word order, tense - are corrected once
 * the message is sent, inside the reply call that was already being made.
 */
export function DraftHints({ draft }: { draft: string }) {
  const hints = useMemo(() => {
    // On a Latin-script build every English word would come back unknown, so
    // the check only runs on text that is plausibly an attempt at the target.
    if (!looksLikeTarget(draft)) return [];
    return checkDraft(draft);
  }, [draft]);

  return (
    <AnimatePresence initial={false}>
      {hints.length > 0 && (
        <motion.ul
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.15 }}
          className="mb-2 flex flex-col gap-1 overflow-hidden"
          aria-live="polite"
        >
          {hints.map((h) => (
            <li key={`${h.kind}-${h.found}`} className="flex flex-wrap items-baseline gap-x-1.5 text-[12px] text-ink-soft">
              <span
                lang={lang.code}
                dir={lang.dir}
                className="text-[14px] text-ink decoration-dotted underline underline-offset-2"
              >
                {h.found}
              </span>
              {h.suggestion && (
                <>
                  <span aria-hidden className="text-ink-faint">
                    →
                  </span>
                  <span lang={lang.code} dir={lang.dir} className="text-[14px] text-lapis">
                    {h.suggestion}
                  </span>
                </>
              )}
              <span className="text-ink-faint">{h.whyEn}</span>
            </li>
          ))}
        </motion.ul>
      )}
    </AnimatePresence>
  );
}
