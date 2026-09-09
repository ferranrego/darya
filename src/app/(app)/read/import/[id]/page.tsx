"use client";

import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { TextReader, type GlossOutcome } from "@/components/reader/text-reader";
import { markImportRead, markImportedName } from "@/lib/db/imports";
import { XP, recordActivity } from "@/lib/gamification";
import {
  useImport,
  useInvalidateLearning,
  usePersonalIndex,
  useSupabase,
  useUser,
} from "@/lib/queries/hooks";

/**
 * Reading an imported article.
 *
 * Same reader as everything else, with four differences, all of them because
 * this text is the learner's own rather than the curriculum's:
 *
 *  - unknown words are ordinary vocabulary, not names, and looking one up adds
 *    it to the learner's personal dictionary;
 *  - sentences are translated as they are opened;
 *  - finishing records progress on the import's own row and does NOT touch the
 *    level estimate, because an arbitrary article says nothing about level;
 *  - there is no "tap every new word" gate, which on a real article would mean
 *    dozens of taps before it could be finished.
 */
export default function ImportedReadPage() {
  const params = useParams();
  const router = useRouter();
  const db = useSupabase();
  const qc = useQueryClient();
  const { data: user } = useUser();
  const invalidate = useInvalidateLearning();
  const personalIndex = usePersonalIndex();

  const id = typeof params?.id === "string" ? params.id : undefined;
  const { data: row, isLoading } = useImport(id);

  // Set by the import form when the article arrived but its translation did
  // not. Read once and cleared - it describes that import, not this reading.
  //
  // Read in an effect rather than a lazy useState initializer on purpose:
  // sessionStorage does not exist during SSR, so an initializer would render
  // null on the server and the message on the client, which is a hydration
  // mismatch. One render after mount is the correct cost here.
  const [warning, setWarning] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    try {
      const key = `import-warning:${id}`;
      const stored = sessionStorage.getItem(key);
      if (stored) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setWarning(stored);
        sessionStorage.removeItem(key);
      }
    } catch {
      // Private browsing can throw on access; the warning is not load-bearing.
    }
  }, [id]);

  if (isLoading) {
    return (
      <div className="animate-pulse pt-2">
        <div className="h-10 w-2/3 rounded-lg bg-line/60" />
        <div className="mt-10 space-y-7">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-8 w-full rounded-lg bg-line/50" />
              <div className="h-8 w-4/5 rounded-lg bg-line/40" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <h2 className="text-[20px] font-semibold">Reading not found</h2>
        <p className="mt-2 text-ink-soft">This import may have been removed.</p>
        <Link
          href="/read/import"
          className="mt-6 rounded-full bg-lapis px-6 py-2.5 text-[15px] font-medium text-white transition-opacity hover:opacity-90"
        >
          Back to imports
        </Link>
      </div>
    );
  }

  return (
    <div className="relative">
      <Link
        href="/read/import"
        className="absolute -left-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-surface/80 backdrop-blur transition-colors hover:bg-line/50"
        aria-label="Back to imports"
      >
        <ChevronLeft size={24} />
      </Link>

      {warning ? (
        <p className="mt-10 rounded-xl bg-ink/5 px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
          {warning} You can still read it - open any sentence to translate it on its own.
        </p>
      ) : null}

      {row.truncated ? (
        <p className={`${warning ? "mt-3" : "mt-10"} rounded-xl bg-ink/5 px-4 py-2.5 text-[13px] text-ink-soft`}>
          This article was long, so only the first part was imported.
        </p>
      ) : null}

      <div className="pt-2">
        <TextReader
          key={row.id}
          doc={row.doc}
          personalIndex={personalIndex}
          treatUnresolvedAsNew
          requireAllNewWordsTapped={false}
          onGlossUnknown={async (surface, sentenceIndex): Promise<GlossOutcome> => {
            let data: {
              kind?: string;
              lexemeId?: string;
              error?: string;
              usedAsName?: boolean;
            };
            try {
              const res = await fetch("/api/import/gloss", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  surface,
                  sentence: row.doc.sentences[sentenceIndex]?.target ?? "",
                  textId: row.id,
                }),
              });
              data = await res.json();
              if (!res.ok) {
                // The route already classified this into something a learner
                // can act on - out of quota, too slow, or a word the models
                // cannot place. Pass it through rather than flattening it.
                return {
                  kind: "error",
                  message: data?.error ?? "Couldn't look this word up.",
                };
              }
            } catch {
              return { kind: "error", message: "You appear to be offline." };
            }

            // A proper noun is a real answer: no entry, no SRS row. Record it
            // in the document so every other occurrence renders as a name and
            // costs no further lookup.
            if (data.kind === "name") {
              try {
                await markImportedName(db, row.id, surface);
                await qc.invalidateQueries({ queryKey: ["imported_text", row.id] });
              } catch {
                // Cosmetic and a cost saving, not correctness - the answer
                // shown to the learner is already right.
              }
              return { kind: "name" };
            }

            // A new personal entry has to reach the index before the reader can
            // colour it, so refresh the dictionary before returning.
            if (data.kind === "personal") {
              await qc.invalidateQueries({ queryKey: ["user_lexemes"] });
            }
            return typeof data.lexemeId === "string"
              ? { kind: "lexeme", lexemeId: data.lexemeId, usedAsName: data.usedAsName }
              : { kind: "error", message: "Couldn't look this word up." };
          }}
          onRequestTranslation={async (index) => {
            let res: Response;
            try {
              res = await fetch("/api/import/translate", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ id: row.id, index }),
              });
            } catch {
              return "You appear to be offline.";
            }
            if (!res.ok) {
              const data = await res.json().catch(() => null);
              return data?.error ?? "Couldn't translate this sentence.";
            }
            // The route wrote the translations into the stored document, so
            // refetching is what makes them appear - no client-side merge to
            // drift from what was actually saved.
            await qc.invalidateQueries({ queryKey: ["imported_text", row.id] });
            return null;
          }}
          onFinish={async (tapCount) => {
            await markImportRead(db, row.id, tapCount);
            if (user) {
              // XP yes, `texts_read` no: that counter means curriculum texts,
              // and the level forecast is built on it.
              await recordActivity(db, user.id, { xp: XP.textRead });
            }
            await Promise.all([
              invalidate(),
              qc.invalidateQueries({ queryKey: ["imported_texts"] }),
            ]);
          }}
          onFinished={() => router.push("/read/import")}
        />
      </div>
    </div>
  );
}
