"use client";

import type { Letter } from "@/lib/content/schema";

const formLabels = [
  ["isolated", "alone"],
  ["initial", "start"],
  ["medial", "middle"],
  ["final", "end"],
] as const;

export function LetterCard({ letter }: { letter: Letter }) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-6 py-10 text-center shadow-[0_2px_20px_rgba(31,26,23,0.05)]">
      <p lang="prs" className="text-[96px] leading-none text-ink">
        {letter.char}
      </p>
      <p className="mt-5 text-[20px] font-semibold tracking-tight">
        {letter.name} <span className="font-normal text-ink-soft">· {letter.translit}</span>
      </p>
      <p className="mt-1 text-[14px] text-ink-soft">{letter.sound}</p>

      <div dir="rtl" className="mt-8 grid grid-cols-4 gap-2">
        {formLabels.map(([key, label]) => (
          <div key={key} className="rounded-xl bg-paper py-3">
            <p lang="prs" className="text-[30px] leading-tight">
              {letter.forms[key]}
            </p>
            <p dir="ltr" className="mt-1.5 text-[11px] text-ink-faint">
              {label}
            </p>
          </div>
        ))}
      </div>
      {letter.nonConnecting && (
        <p className="mt-4 text-[12px] text-ink-faint">
          This letter never joins to the letter after it.
        </p>
      )}
    </div>
  );
}
