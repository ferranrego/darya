"use client";

import { useMutation } from "@tanstack/react-query";
import { Check, ChevronLeft, Link2, Loader2, Newspaper, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { deleteImport } from "@/lib/db/imports";
import { profile as langProfile } from "@/lib/lang";
import { useImports, useInvalidateLearning, useSupabase } from "@/lib/queries/hooks";

/**
 * Bring in an article to read.
 *
 * Two ways in, and the second is not a fallback so much as the reliable one:
 * paywalls, consent walls and client-rendered pages are common enough that a
 * URL-only import would fail often, and pasting the text costs the learner one
 * gesture and the server nothing.
 */
export default function ImportPage() {
  const router = useRouter();
  const db = useSupabase();
  const invalidate = useInvalidateLearning();
  const { data: imports, refetch } = useImports();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [mode, setMode] = useState<"url" | "paste">("url");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = useMutation({
    mutationFn: async () => {
      setError(null);
      const body = mode === "url" ? { url } : { text, title };
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Couldn't import that.");
      return data as { id: string; translationWarning: string | null };
    },
    onSuccess: async (data) => {
      await Promise.all([invalidate(), refetch()]);
      // The article imported, but its English did not arrive. Say so before
      // navigating: an untranslated import is otherwise indistinguishable from
      // one that simply has not been opened yet.
      if (data.translationWarning) {
        sessionStorage.setItem(`import-warning:${data.id}`, data.translationWarning);
      }
      router.push(`/read/import/${data.id}`);
    },
    onError: (e: Error) => setError(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      await deleteImport(db, id);
    },
    onSuccess: async () => {
      setConfirmDelete(null);
      await refetch();
    },
    onError: (e: Error) => setError(e.message),
  });

  const ready = submit.isPending
    ? false
    : mode === "url"
      ? url.trim().length > 0
      : text.trim().length > 0;

  return (
    <div className="relative pt-2 pb-24">
      <Link
        href="/read"
        className="absolute -left-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/80 backdrop-blur transition-colors hover:bg-line/50"
        aria-label="Back to reading"
      >
        <ChevronLeft size={24} />
      </Link>

      <header className="mt-10 mb-6">
        <h1 className="text-[26px] font-bold leading-tight text-ink">Bring your own reading</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">
          Paste a link to anything written in {langProfile.name}, or the text itself. Every word
          stays tappable, and the ones you look up join your vocabulary.
        </p>
      </header>

      <div className="mb-4 flex gap-1 rounded-full bg-paper p-1">
        {(["url", "paste"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setError(null);
            }}
            aria-pressed={mode === m}
            className={`flex-1 rounded-full py-2 text-[14px] font-semibold transition-colors ${
              mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-soft"
            }`}
          >
            {m === "url" ? "Link" : "Paste text"}
          </button>
        ))}
      </div>

      {mode === "url" ? (
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://…"
          className="w-full rounded-2xl border border-line bg-surface px-4 py-3.5 text-[16px] text-ink outline-none placeholder:text-ink-faint focus:border-lapis"
        />
      ) : (
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title (optional)"
            lang={langProfile.code}
            dir={langProfile.dir}
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[16px] text-ink outline-none placeholder:text-ink-faint focus:border-lapis"
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            lang={langProfile.code}
            dir={langProfile.dir}
            placeholder={langProfile.samples.sentence.target}
            className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3.5 text-[16px] leading-relaxed text-ink outline-none placeholder:text-ink-faint focus:border-lapis"
          />
        </div>
      )}

      {error ? (
        <p className="mt-3 rounded-xl bg-ink/5 px-4 py-3 text-[14px] text-ink-soft">{error}</p>
      ) : null}

      <Button
        size="lg"
        className="mt-5 w-full"
        disabled={!ready}
        onClick={() => submit.mutate()}
      >
        {submit.isPending ? (
          <span className="flex items-center gap-2">
            <Loader2 size={18} className="animate-spin" />
            Reading it…
          </span>
        ) : (
          "Import"
        )}
      </Button>

      {imports && imports.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-[12px] font-semibold uppercase tracking-widest text-ink-faint">
            Your imports
          </h2>
          <p className="mb-3 mt-1 text-[13px] text-ink-soft">
            Deleting one removes the article only - words you looked up stay in your vocabulary.
          </p>
          <div className="flex flex-col gap-2">
            {imports.map((row) =>
              confirmDelete === row.id ? (
                /* Deleting is irreversible, so it asks first - and says the one
                   thing the learner actually needs to know before answering. */
                <div
                  key={row.id}
                  className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink">Delete this reading?</p>
                    <p className="mt-0.5 text-[13px] text-ink-soft">
                      The words you saved from it stay in your vocabulary.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    aria-label="Keep this reading"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-paper"
                  >
                    <X size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove.mutate(row.id)}
                    disabled={remove.isPending}
                    aria-label="Delete this reading"
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-ink text-surface transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {remove.isPending ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Check size={18} />
                    )}
                  </button>
                </div>
              ) : (
                <div
                  key={row.id}
                  className="flex items-start gap-1 rounded-2xl border border-line bg-surface transition-shadow hover:shadow-sm"
                >
                  <Link
                    href={`/read/import/${row.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3 p-4"
                  >
                    <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-paper text-lapis">
                      {row.source_url ? <Link2 size={18} /> : <Newspaper size={18} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        lang={langProfile.code}
                        dir={langProfile.dir}
                        className="truncate text-[16px] font-semibold text-ink"
                      >
                        {row.doc.titleTarget}
                      </p>
                      {row.title_en ? (
                        <p className="truncate text-[13px] text-ink-soft">{row.title_en}</p>
                      ) : null}
                      <p className="mt-1 text-[12px] text-ink-faint">
                        {row.sentence_count} sentences
                        {row.new_word_ratio !== null
                          ? ` · you know ~${Math.round((1 - row.new_word_ratio) * 100)}% of the words`
                          : ""}
                        {row.read_at ? " · read" : ""}
                      </p>
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setConfirmDelete(row.id);
                    }}
                    aria-label={`Delete ${row.title_en || row.doc.titleTarget}`}
                    className="mr-2 mt-3 flex size-10 shrink-0 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-paper hover:text-ink"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
