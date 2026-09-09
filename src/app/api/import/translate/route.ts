import { NextResponse } from "next/server";
import { LAZY_BATCH, translateImportSpan } from "@/lib/ai/import-translate";
import { translationFailure } from "@/lib/ai/import-failure";
import { deadlineIn } from "@/lib/ai/providers";
import { getImport, setImportedSentence } from "@/lib/db/imports";
import { supabaseServer } from "@/lib/supabase/server";

export const maxDuration = 30;
export const runtime = "nodejs";

/**
 * Translate a sentence the learner just opened, plus the next two.
 *
 * ONE model call per three sentences, and only for sentences a learner
 * actually opens. Translating a whole article up front would be roughly ten
 * sequential calls inside one function invocation - over the time limit, and
 * spending the shared quota on sentences most readers never expand.
 */

/** Comfortably inside maxDuration, the same margin the chat routes use. */
const BUDGET_MS = 20_000;

export async function POST(req: Request) {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let id: string;
  let index: number;
  try {
    const body = await req.json();
    id = String(body.id);
    index = Number(body.index);
    if (!id || !Number.isInteger(index) || index < 0) throw new Error("bad body");
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // RLS scopes this to the caller's own imports.
  const row = await getImport(db, id);
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  const doc = row.doc;
  if (index >= doc.sentences.length) {
    return NextResponse.json({ error: "no such sentence" }, { status: 400 });
  }

  // Take the requested sentence and the next two, skipping any already done, so
  // re-opening a sentence never spends a second call on it.
  const wanted: number[] = [];
  for (let i = index; i < doc.sentences.length && wanted.length < LAZY_BATCH; i++) {
    if (!doc.sentences[i].en) wanted.push(i);
  }
  if (wanted.length === 0) {
    return NextResponse.json({ sentences: [] });
  }

  let translated;
  try {
    translated = await translateImportSpan({
      sentences: wanted.map((i) => doc.sentences[i].target),
      deadline: deadlineIn(BUDGET_MS),
    });
  } catch (e) {
    // The raw message carries provider names and status codes; the learner gets
    // a classification of it, not the text. Which of the five it is decides
    // whether "try again" is even true - for `invalid` it is not.
    console.error("Import sentence translation failed:", e);
    const failure = translationFailure(e);
    return NextResponse.json(
      { error: failure.message, reason: failure.reason },
      { status: failure.status },
    );
  }

  const out: { index: number; en: string; translit?: string }[] = [];
  for (const s of translated.sentences) {
    const target = wanted[s.i];
    if (target === undefined) continue;
    // jsonb_set through an RPC, not a read-modify-write of `doc`: two sentences
    // opened in quick succession would otherwise race and lose one.
    await setImportedSentence(db, id, target, s.en, s.translit);
    out.push({ index: target, en: s.en, translit: s.translit });
  }

  return NextResponse.json({ sentences: out });
}
