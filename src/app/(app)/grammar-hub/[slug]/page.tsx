import { ChevronLeft, ChevronRight, GraduationCap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AskTutorLink } from "@/components/grammar-hub/ask-tutor-link";
import { HubBlocks } from "@/components/grammar-hub/block-renderer";
import { HUB_CHAPTER_TITLE, hubEntries, hubEntryBySlug } from "@/lib/content/grammar-hub";
import { grammarLessonById } from "@/lib/content/load";
import { profile as lang } from "@/lib/lang";

export default async function GrammarHubEntryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const entry = hubEntryBySlug(slug);
  if (!entry) notFound();

  const lessons = entry.lessonIds.flatMap((id) => {
    const lesson = grammarLessonById(id);
    return lesson ? [lesson] : [];
  });
  const related = entry.related.flatMap((s) => {
    const r = hubEntryBySlug(s);
    return r ? [r] : [];
  });

  // The next page in book order, so the hub can be read front to back.
  const at = hubEntries.findIndex((e) => e.id === entry.id);
  const next = hubEntries[at + 1];

  return (
    <article className="flex flex-col gap-8 pb-4">
      <header className="flex flex-col gap-4 pt-1">
        <Link
          href="/grammar-hub"
          className="-ml-1 flex h-9 w-fit items-center gap-1 pr-2 text-[13px] font-medium text-ink-soft hover:text-lapis"
        >
          <ChevronLeft size={16} />
          Grammar Hub
          <span className="text-ink-faint">·</span>
          <span>
            {entry.level} {HUB_CHAPTER_TITLE[entry.level]}
          </span>
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
          <h1 className="text-balance text-[28px] font-semibold leading-tight tracking-tight">{entry.title}</h1>
          <span lang={lang.code} dir={lang.dir} className="shrink-0 pb-0.5 text-[26px] leading-none text-lapis">
            {entry.sample.target}
          </span>
        </div>
        <div className="rounded-2xl border border-lapis/15 bg-lapis-soft/60 px-4 py-3.5">
          <p className="text-[12px] font-semibold text-lapis">In one line</p>
          <p className="mt-1 text-[16px] leading-relaxed text-ink">{entry.summary}</p>
        </div>
      </header>

      <HubBlocks blocks={entry.blocks} />

      {(lessons.length > 0 || related.length > 0) && (
        <footer className="flex flex-col gap-6 border-t border-line pt-6">
          {lessons.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[17px] font-semibold tracking-tight">Practise it</h2>
              <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                {lessons.map((lesson, i) => (
                  <Link
                    key={lesson.id}
                    href={`/grammar/${lesson.id}`}
                    className={`flex min-h-14 items-center gap-3 px-4 py-3 active:bg-paper ${
                      i > 0 ? "border-t border-line/60" : ""
                    }`}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper text-lapis">
                      <GraduationCap size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{lesson.title}</span>
                      <span className="block truncate text-[13px] text-ink-soft">{lesson.subtitle}</span>
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-ink-faint" />
                  </Link>
                ))}
              </div>
            </section>
          )}

          {related.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-[17px] font-semibold tracking-tight">Related</h2>
              <div className="flex flex-wrap gap-2">
                {related.map((r) => (
                  <Link
                    key={r.id}
                    href={`/grammar-hub/${r.slug}`}
                    className="flex h-10 items-center rounded-full border border-line bg-surface px-4 text-[14px] font-medium text-ink hover:border-lapis/40 hover:text-lapis"
                  >
                    {r.title}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </footer>
      )}

      <section className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <p className="text-[15px] font-medium">Still unsure?</p>
          <p className="mt-0.5 text-[13px] text-ink-soft">
            Ask {lang.brand.mascotName} about {entry.title.toLowerCase()}. Your question opens in the chat, ready to send.
          </p>
        </div>
        <AskTutorLink question={`I have a question about ${entry.title} (${entry.sample.translit}): `} />
      </section>

      {next && (
        <Link
          href={`/grammar-hub/${next.slug}`}
          className="flex items-center justify-between gap-3 rounded-2xl p-1 text-[15px]"
        >
          <span className="min-w-0">
            <span className="block text-[12px] font-medium text-ink-faint">Next page</span>
            <span className="block truncate font-medium text-lapis">{next.title}</span>
          </span>
          <ChevronRight size={18} className="shrink-0 text-lapis" />
        </Link>
      )}
    </article>
  );
}
