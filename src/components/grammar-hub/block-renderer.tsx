import { Check, X } from "lucide-react";
import { ExampleLine } from "@/components/grammar/example-line";
import type { GrammarOption, HubBlock } from "@/lib/content/schema";
import { profile as langProfile } from "@/lib/lang";

/**
 * A run of Perso-Arabic script, including the ZWNJ inside words, the spaces
 * between Dari words and Dari punctuation. Kept as one span so a quoted phrase
 * like من نان می‌خورم stays a single right-to-left island inside English prose.
 */
const TARGET_RUN = /([؀-ۿ‌]+(?:[\s،؟]+[؀-ۿ‌]+)*[؟]?)/;

/**
 * English prose that quotes Dari.
 *
 * Without isolation the bidi algorithm reorders the surrounding English
 * punctuation around the Dari words, so a sentence can end up visually
 * starting with its full stop. `dir` on the span isolates the run, and it
 * never wraps: a two-word phrase broken across lines reads in the wrong order,
 * because the right-hand word lands on the line above.
 */
export function MixedText({ text }: { text: string }) {
  if (!TARGET_RUN.test(text)) return <>{text}</>;
  return (
    <>
      {text.split(TARGET_RUN).map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} lang={langProfile.code} dir={langProfile.dir} className="whitespace-nowrap text-[1.2em]">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

function Phrase({ option, size = "md" }: { option: GrammarOption; size?: "md" | "sm" }) {
  return (
    <div className="min-w-0">
      <p
        lang={langProfile.code}
        dir={langProfile.dir}
        className={`text-start ${size === "md" ? "text-[22px] leading-[1.8]" : "text-[20px] leading-[1.8]"}`}
      >
        {option.target}
      </p>
      {option.translit && <p className="text-[14px] text-ink-soft">{option.translit}</p>}
    </div>
  );
}

function BlockHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-3 text-[17px] font-semibold tracking-tight text-ink">{children}</h2>;
}

function BlockBody({ block }: { block: HubBlock }) {
  switch (block.type) {
    case "rule":
      return (
        <p className="text-[15px] leading-[1.7] text-ink">
          <MixedText text={block.body} />
        </p>
      );

    case "pattern":
      return (
        <div
          className="flex flex-wrap items-center gap-x-1.5 gap-y-2 rounded-2xl border border-line bg-surface px-3.5 py-3.5"
          aria-label={block.parts.map((p) => p.text).join(" plus ")}
        >
          {block.parts.map((part, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {i > 0 && (
                <span aria-hidden className="text-[15px] text-ink-faint">
                  +
                </span>
              )}
              <span
                className={
                  part.kind === "fixed"
                    ? "whitespace-nowrap rounded-xl bg-lapis-soft px-2.5 py-1.5 text-[15px] font-semibold text-lapis"
                    : "whitespace-nowrap rounded-xl border border-dashed border-ink-faint/50 px-2.5 py-1.5 text-[14px] text-ink-soft"
                }
              >
                {part.text}
              </span>
            </span>
          ))}
        </div>
      );

    case "table":
      return (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          {block.columns && (
            <div className="flex items-center justify-between gap-4 bg-paper/70 px-4 py-2 text-[12px] font-medium text-ink-faint">
              <span>{block.columns[0]}</span>
              <span>{block.columns[1]}</span>
            </div>
          )}
          {block.rows.map(([left, right], i) => (
            <div
              key={i}
              className={`flex items-center justify-between gap-4 px-4 py-2.5 ${
                i > 0 || block.columns ? "border-t border-line/60" : ""
              }`}
            >
              <span className="text-[15px] text-ink-soft">
                <MixedText text={left} />
              </span>
              <span className="shrink-0 text-end text-[16px] font-medium text-lapis">
                <MixedText text={right} />
              </span>
            </div>
          ))}
        </div>
      );

    case "examples":
      return (
        <div className="flex flex-col gap-2.5">
          {block.items.map((item) => (
            <ExampleLine key={item.target} example={item} size="md" />
          ))}
        </div>
      );

    case "mistake":
      return (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="flex items-start gap-3 px-4 py-3">
            <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-danger/10 text-danger">
              <X size={14} strokeWidth={2.5} aria-label="Wrong" />
            </span>
            <div className="min-w-0 opacity-70">
              <Phrase option={block.wrong} size="sm" />
            </div>
          </div>
          <div className="flex items-start gap-3 border-t border-line/60 px-4 py-3">
            <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-sabz-soft text-sabz">
              <Check size={14} strokeWidth={2.5} aria-label="Right" />
            </span>
            <div className="min-w-0">
              <Phrase option={block.right} size="sm" />
              <p className="text-[13px] text-ink-faint">{block.right.en}</p>
            </div>
          </div>
          <p className="border-t border-line/60 bg-paper/60 px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
            <MixedText text={block.why} />
          </p>
        </div>
      );

    case "spoken":
      return (
        <div className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="grid grid-cols-2 divide-x divide-line/60">
            <div className="px-4 py-3">
              <p className="text-[12px] font-medium text-ink-faint">Written</p>
              <Phrase option={block.written} size="sm" />
            </div>
            <div className="px-4 py-3">
              <p className="text-[12px] font-medium text-ink-faint">Spoken in Kabul</p>
              <Phrase option={block.spoken} size="sm" />
            </div>
          </div>
          <p className="border-t border-line/60 bg-paper/60 px-4 py-3 text-[14px] leading-relaxed text-ink-soft">
            <MixedText text={block.note} />
          </p>
        </div>
      );
  }
}

/** Default headings for blocks whose kind is its own best title. */
const DEFAULT_HEADING: Partial<Record<HubBlock["type"], string>> = {
  mistake: "Watch out",
};

export function HubBlockView({ block }: { block: HubBlock }) {
  const heading = block.heading ?? DEFAULT_HEADING[block.type];
  return (
    <section>
      {heading && <BlockHeading>{heading}</BlockHeading>}
      <BlockBody block={block} />
    </section>
  );
}

/**
 * Blocks grouped into sections: a block without its own heading continues the
 * section above it, so a rule and the examples that illustrate it sit together
 * with one heading and tighter spacing.
 */
export function HubBlocks({ blocks }: { blocks: HubBlock[] }) {
  const sections: HubBlock[][] = [];
  blocks.forEach((block, i) => {
    // Two mistakes in a row share one "Watch out" rather than repeating it.
    const startsSection =
      block.heading !== undefined ||
      (DEFAULT_HEADING[block.type] !== undefined && blocks[i - 1]?.type !== block.type);
    if (startsSection || sections.length === 0) sections.push([block]);
    else sections[sections.length - 1].push(block);
  });
  return (
    <div className="flex flex-col gap-9">
      {sections.map((section, i) => (
        <div key={i} className="flex flex-col gap-3">
          {section.map((block, j) =>
            j === 0 ? <HubBlockView key={j} block={block} /> : <BlockBody key={j} block={block} />,
          )}
        </div>
      ))}
    </div>
  );
}
