import { NextResponse } from "next/server";
import { EAGER_SENTENCES, translateImportSpan } from "@/lib/ai/import-translate";
import { translationFailure } from "@/lib/ai/import-failure";
import { deadlineIn } from "@/lib/ai/providers";
import { assembleImport, ImportTooShortError, MAX_CHARS } from "@/lib/import/assemble";
import { cleanArticleText } from "@/lib/import/clean";
import { extractArticle, type Extractor } from "@/lib/import/extract";
import { fetchArticle, ImportFetchError } from "@/lib/import/fetch-url";
import { countImportsSince, insertImport } from "@/lib/db/imports";
import { profile as langProfile } from "@/lib/lang";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Import an article the learner brought in, from a URL or pasted text.
 *
 * Model calls per request: exactly ONE, translating the title and the first
 * few sentences. Everything else - fetching, extraction, cleaning, sentence
 * splitting, tokenization, the difficulty estimate - is offline. The rest of
 * the article is translated as the learner opens it, three sentences at a time,
 * and only for sentences they actually open.
 */

/** Under the 60s function limit, leaving ~15s for fetch, parse and the write. */
const BUDGET_MS = 45_000;

/**
 * One learner shares the provider quota with every other learner of the
 * deployment, so an import loop from a script has to be bounded here rather
 * than in the UI.
 */
const MAX_IMPORTS_PER_DAY = 20;

export async function POST(req: Request) {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  // Auth first, and before any outbound fetch: an unauthenticated endpoint that
  // fetches a URL of the caller's choosing is an open proxy.
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let url: string | undefined;
  let pasted: string | undefined;
  let pastedTitle: string | undefined;
  try {
    const body = await req.json();
    url = typeof body?.url === "string" ? body.url : undefined;
    pasted = typeof body?.text === "string" ? body.text : undefined;
    pastedTitle = typeof body?.title === "string" ? body.title : undefined;
  } catch {
    return NextResponse.json({ error: "Send a URL or some text." }, { status: 400 });
  }
  if (!url && !pasted) {
    return NextResponse.json({ error: "Send a URL or some text." }, { status: 400 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  if ((await countImportsSince(db, user.id, since)) >= MAX_IMPORTS_PER_DAY) {
    return NextResponse.json(
      { error: "That's a lot of reading for one day. Try again tomorrow." },
      { status: 429 },
    );
  }

  let rawText: string;
  let title: string;
  let extractor: Extractor;
  let sourceUrl: string | null = null;

  try {
    if (url) {
      const page = await fetchArticle(url);
      const extracted = extractArticle(page.html, page.finalUrl);
      rawText = extracted.text;
      title = extracted.title;
      extractor = extracted.extractor;
      sourceUrl = page.finalUrl;
    } else {
      rawText = pasted!.slice(0, MAX_CHARS);
      title = pastedTitle?.trim() ?? "";
      extractor = "paste";
    }
  } catch (e) {
    if (e instanceof ImportFetchError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error("Import fetch/extract failed:", e);
    return NextResponse.json({ error: "Couldn't read that page." }, { status: 400 });
  }

  // Which lexemes this learner already has, for the readability estimate. Not a
  // gate - they chose this article.
  const { data: words } = await db
    .from("user_words")
    .select("lexeme_id")
    .eq("user_id", user.id);
  const familiar = new Set((words ?? []).map((w) => w.lexeme_id as string));

  let assembled;
  try {
    assembled = assembleImport({
      text: cleanArticleText(rawText),
      title: cleanArticleText(title) || title,
      sourceUrl,
      familiar,
    });
  } catch (e) {
    if (e instanceof ImportTooShortError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }

  const { doc, truncated, charCount } = assembled;

  // One deadline for the whole request, shared by the single completion. A
  // per-call budget is how a route ends up outliving its own maxDuration.
  const deadline = deadlineIn(BUDGET_MS);
  const head = doc.sentences.slice(0, EAGER_SENTENCES);
  let translationWarning: string | null = null;
  try {
    const translated = await translateImportSpan({
      sentences: head.map((s) => s.target),
      title: doc.titleTarget,
      deadline,
    });
    doc.titleEn = translated.titleEn ?? "";
    if (translated.titleTranslit) doc.titleTranslit = translated.titleTranslit;
    for (const s of translated.sentences) {
      doc.sentences[s.i].en = s.en;
      if (s.translit) doc.sentences[s.i].translit = s.translit;
    }
    markNames(doc, translated.names);
  } catch (e) {
    // A failed translation is not a failed import: the article is already
    // readable, tappable and trackable, and each sentence can be translated on
    // demand. Losing the whole import over the English would be worse.
    //
    // But it must not be silent either. This was swallowed entirely, so an
    // article that imported with no title and no English looked identical to
    // one that had simply not been opened yet - the learner had no way to know
    // anything had gone wrong, and no way to say what.
    console.error("Import translation failed:", e);
    translationWarning = translationFailure(e).message;
  }

  try {
    await insertImport(db, {
      id: doc.id,
      user_id: user.id,
      source_url: sourceUrl,
      title_en: doc.titleEn || null,
      doc,
      extractor,
      truncated,
      lang: langProfile.code,
      char_count: charCount,
      sentence_count: doc.sentences.length,
      new_word_ratio: doc.newWordRatio,
    });
  } catch (e) {
    console.error("Import insert failed:", e);
    return NextResponse.json({ error: "Couldn't save that reading." }, { status: 500 });
  }

  return NextResponse.json({
    id: doc.id,
    sentenceCount: doc.sentences.length,
    newWordRatio: doc.newWordRatio,
    truncated,
    translationWarning,
  });
}

/**
 * Mark the proper nouns the model reported, so a name is never offered to the
 * learner as new vocabulary. Only within the sentences that were translated -
 * the rest are classified when the learner taps them.
 */
function markNames(doc: { sentences: { tokens: { surface: string; kind?: "name" }[] }[] }, names: string[]) {
  if (names.length === 0) return;
  const set = new Set(names.map((n) => n.toLowerCase()));
  for (const sentence of doc.sentences.slice(0, EAGER_SENTENCES)) {
    for (const token of sentence.tokens) {
      if (set.has(token.surface.toLowerCase())) token.kind = "name";
    }
  }
}
