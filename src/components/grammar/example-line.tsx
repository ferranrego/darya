import type { GrammarExample } from "@/lib/content/schema";
import { profile as langProfile } from "@/lib/lang";

/**
 * Dari example with the taught pattern highlighted in lapis.
 *
 * Shared by the course slides (`lg`, one idea per screen) and the Grammar Hub
 * (`md`, several examples on a scrolling reference page).
 */
export function ExampleLine({ example, size = "lg" }: { example: GrammarExample; size?: "lg" | "md" }) {
  const { target, highlight } = example;
  let parts: React.ReactNode = target;
  if (highlight && target.includes(highlight)) {
    const at = target.indexOf(highlight);
    parts = (
      <>
        {target.slice(0, at)}
        <span className="text-lapis">{highlight}</span>
        {target.slice(at + highlight.length)}
      </>
    );
  }
  const lg = size === "lg";
  return (
    <div className={`rounded-2xl border border-line bg-surface ${lg ? "px-5 py-4" : "px-4 py-3"}`}>
      <p
        lang={langProfile.code}
        dir={langProfile.dir}
        className={lg ? "text-[28px] leading-[1.8]" : "text-[22px] leading-[1.9]"}
      >
        {parts}
      </p>
      <p className={`mt-1.5 text-ink-soft ${lg ? "text-[15px]" : "text-[14px]"}`}>{example.translit}</p>
      <p className={`mt-0.5 text-ink-faint ${lg ? "text-[14px]" : "text-[13px]"}`}>{example.en}</p>
    </div>
  );
}
