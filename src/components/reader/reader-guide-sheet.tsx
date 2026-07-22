"use client";

import { ArrowDown, Highlighter, Languages } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Poncha } from "@/components/poncha";
import { Button } from "@/components/ui/button";

/**
 * One-time (and on-demand) explainer for the reader. Replaces the old
 * always-visible legend: instead of three static chips it walks through the
 * word lifecycle — New → tap → Learning → reviews → Known — with sample words
 * styled exactly as they appear in the text.
 */
export function ReaderGuideSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="guide-scrim"
            className="fixed inset-0 z-40 bg-ink/10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            key="guide-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="How reading works"
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl border border-b-0 border-line bg-surface px-6 pt-3 shadow-[0_-8px_40px_rgba(31,26,23,0.12)]"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 500, damping: 42 }}
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.5rem)" }}
          >
            <div className="mx-auto mb-5 h-1 w-9 shrink-0 rounded-full bg-line" />

            <div className="flex items-center gap-4">
              <Poncha pose="read" size={72} />
              <div>
                <h2 className="text-[20px] font-semibold tracking-tight">How reading works</h2>
                <p className="mt-0.5 text-[14px] text-ink-soft">
                  Tap any word to see what it means.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-col">
              <GuideRow
                sample="کتاب"
                sampleCls="bg-new-tint rounded-md"
                label="New"
                description="Softly highlighted. Tap it to reveal the meaning — Darya starts tracking it for you."
              />
              <GuideArrow hint="you tap it" />
              <GuideRow
                sample="خانه"
                sampleCls="underline decoration-lapis decoration-2 underline-offset-8 font-medium"
                label="Learning"
                labelCls="text-lapis"
                description="Underlined in blue. It joins your reviews and comes back until it sticks."
              />
              <GuideArrow hint="after reviews" />
              <GuideRow
                sample="من"
                sampleCls=""
                label="Known"
                labelCls="text-sabz"
                description="Plain text — the marks fade away once a word is yours."
              />
            </div>

            <div className="mt-6 flex flex-col gap-2 rounded-2xl bg-paper p-4 text-[13px] text-ink-soft">
              <div className="flex items-center gap-2.5">
                <Languages size={15} className="shrink-0 text-ink-faint" />
                <span>Show pronunciation under each sentence</span>
              </div>
              <div className="flex items-center gap-2.5">
                <Highlighter size={15} className="shrink-0 text-ink-faint" />
                <span>Color-code words by grammar role</span>
              </div>
            </div>

            <Button size="lg" className="mt-6 w-full" onClick={onClose}>
              Got it
            </Button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function GuideRow({
  sample,
  sampleCls,
  label,
  labelCls = "",
  description,
}: {
  sample: string;
  sampleCls: string;
  label: string;
  labelCls?: string;
  description: string;
}) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex w-[76px] shrink-0 items-center justify-center rounded-xl border border-line bg-surface py-2.5">
        <span lang="prs" className={`px-1 text-[22px] leading-normal ${sampleCls}`}>
          {sample}
        </span>
      </div>
      <div>
        <p className={`text-[14px] font-semibold ${labelCls}`}>{label}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-ink-soft">{description}</p>
      </div>
    </div>
  );
}

function GuideArrow({ hint }: { hint: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-[30px]">
      <ArrowDown size={14} className="text-ink-faint" />
      <span className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{hint}</span>
    </div>
  );
}
