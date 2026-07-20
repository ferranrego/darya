import Link from "next/link";
import { notFound } from "next/navigation";
import { getWordsByThemeOnly } from "@/lib/content/load";

export default async function ThemePage({
  params,
}: {
  params: Promise<{ theme: string }>;
}) {
  const { theme } = await params;
  const decodedTheme = decodeURIComponent(theme);
  
  const words = getWordsByThemeOnly(decodedTheme);

  if (words.length === 0) {
    notFound();
  }

  // Sort words by freqBand (difficulty proxy)
  const sortedWords = [...words].sort((a, b) => (a.freqBand || 1) - (b.freqBand || 1));

  return (
    <div className="flex flex-col gap-6 pb-24 pt-2 px-1">
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center flex-wrap gap-2 text-[13px] font-medium text-ink-soft mb-2">
          <Link href="/words" className="hover:text-lapis transition-colors">Categories</Link>
          <span>/</span>
          <span className="text-ink truncate max-w-[200px] sm:max-w-none">{decodedTheme}</span>
        </div>
        <h1 className="text-[28px] font-bold tracking-tight text-ink">
          {decodedTheme}
        </h1>
        <p className="text-[15px] text-ink-soft leading-relaxed">
          {words.length} words in this collection.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {sortedWords.map((word) => (
          <div
            key={word.id}
            className="group relative overflow-hidden rounded-[20px] border border-line bg-surface p-5 transition-all duration-300 hover:border-lapis/30 hover:shadow-[0_8px_30px_rgba(43,76,140,0.08)]"
          >
            {/* Soft background glow on hover */}
            <div className="absolute inset-0 bg-gradient-to-br from-lapis-soft/20 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none" />
            
            <div className="relative z-10 flex flex-col gap-1.5">
              <div className="flex items-start justify-between">
                <div className="flex flex-col">
                  <p lang="prs" className="text-[26px] leading-snug text-ink mb-1">
                    {word.dari}
                  </p>
                  <p className="text-[13px] text-ink-soft font-medium tracking-wide">
                    {word.translit}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-md bg-sabz-soft/40 px-2 py-0.5 text-[11px] font-bold tracking-wide text-sabz uppercase border border-sabz/10">
                    {word.pos}
                  </span>
                  {word.register !== "neutral" && (
                    <span className="inline-flex items-center rounded-md bg-saffron-soft/40 px-2 py-0.5 text-[11px] font-bold tracking-wide text-saffron uppercase border border-saffron/10">
                      {word.register}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-2 text-[16px] font-semibold text-ink leading-tight">
                {word.glossEn}
              </div>

              {(word.exampleDari || word.exampleEn) && (
                <details className="mt-3 group/details">
                  <summary className="inline-flex cursor-pointer select-none items-center gap-1.5 text-[13px] font-semibold text-lapis hover:text-lapis-deep transition-colors list-none">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition-transform duration-200 group-open/details:rotate-90">
                      <path d="m9 18 6-6-6-6"/>
                    </svg>
                    Example
                  </summary>
                  <div className="mt-2.5 flex flex-col gap-1.5 rounded-xl bg-paper p-3.5 border border-line/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <p lang="prs" className="text-[18px] leading-relaxed text-ink">
                      {word.exampleDari}
                    </p>
                    {word.exampleTranslit && (
                      <p className="text-[13px] text-ink-soft mb-0.5">
                        {word.exampleTranslit}
                      </p>
                    )}
                    <p className="text-[14px] text-ink-soft italic">
                      {word.exampleEn}
                    </p>
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
