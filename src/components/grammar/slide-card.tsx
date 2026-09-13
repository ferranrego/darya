import type { GrammarSlide } from "@/lib/content/schema";
import { ExampleLine } from "./example-line";

/** One teaching slide: explanation, optional paradigm table, examples. */
export function SlideCard({ slide }: { slide: GrammarSlide }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[22px] font-semibold tracking-tight">{slide.title}</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{slide.body}</p>
      </div>

      {slide.table && (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {slide.table.map(([left, right], i) => (
            <div
              key={i}
              className={`flex items-center justify-between gap-4 px-5 py-2.5 ${
                i > 0 ? "border-t border-line/60" : ""
              }`}
            >
              <span dir="auto" className="text-[15px] text-ink-soft">
                {left}
              </span>
              <span dir="auto" className="text-[17px] font-medium text-lapis">
                {right}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3">
        {slide.examples.map((example) => (
          <ExampleLine key={example.target} example={example} />
        ))}
      </div>
    </div>
  );
}
