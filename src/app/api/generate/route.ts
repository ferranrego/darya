import { NextResponse } from "next/server";
import { generateText, vocabHash } from "@/lib/ai/generate";
import { lexicon, levelById } from "@/lib/content/load";
import { assumedKnown, placementCredit } from "@/lib/content/text-pool";
import { selectKnown, selectTargets, targetCountFor } from "@/lib/content/word-selection";
import { insertGeneratedText } from "@/lib/db/texts";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Ensure the signed-in user has at least `want` unread texts at their level.
 * Generates (and caches, shared across users) only when the pool runs dry.
 */
export async function POST(req: Request) {
  let theme: string | undefined = undefined;
  let force: boolean = false;
  try {
    const body = await req.json();
    theme = body?.theme;
    force = body?.force === true;
  } catch {
    // ignore
  }

  // If no theme is provided, pick a random one so "Surprise Me!" gives diverse texts
  if (!theme) {
    const defaultThemes = ["Daily Life", "Food", "Travel", "Work", "Folktales", "Family", "Shopping", "Friendship"];
    theme = defaultThemes[Math.floor(Math.random() * defaultThemes.length)];
  }

  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: profile }, { data: words }, { data: readRows }] = await Promise.all([
    db.from("profiles").select("*").eq("id", user.id).single(),
    db.from("user_words").select("lexeme_id,status").eq("user_id", user.id),
    db.from("user_texts").select("text_id").eq("user_id", user.id),
  ]);
  if (!profile) return NextResponse.json({ error: "no profile" }, { status: 400 });

  const level = levelById(profile.level_estimate);
  const readIds = new Set((readRows ?? []).map((r) => r.text_id));

  const { data: pool } = await db.from("texts").select("id, theme").eq("level", level.id);
  const unread = (pool ?? []).filter((t) => !readIds.has(t.id));
  
  if (!force) {
    if (theme) {
      const unreadThemed = unread.filter((t) => t.theme === theme);
      if (unreadThemed.length > 0) {
        return NextResponse.json({ created: false, unread: unreadThemed.length });
      }
    } else {
      if (unread.length > 0) {
        return NextResponse.json({ created: false, unread: unread.length });
      }
    }
  }

  // Build the vocabulary constraint the same way the reader measures a text
  // against it. `placementCredit` is the single definition of what a placement
  // credits a learner with, and it is the learner's *own* level: reading it off
  // the level below is the documented bug that left the reader with nothing it
  // would show, fixed in the reader and left in place here, so the two halves
  // of the contract disagreed at every level.
  const trackedIds = (words ?? [])
    .filter((w) => w.status === "known" || w.status === "learning")
    .map((w) => w.lexeme_id);
  const knownIds = assumedKnown(
    trackedIds,
    placementCredit(level.entryKnownWords, lexicon.entries, trackedIds),
  );

  const inBand = lexicon.entries.filter((e) => level.freqBands.includes(e.freqBand));
  const knownWords = lexicon.entries.filter((e) => knownIds.has(e.id));
  const candidates = inBand.filter((e) => !knownIds.has(e.id));

  // A brand-new learner at the first level has nothing yet, so fall back to the
  // most frequent words of the level rather than an empty constraint.
  const effectiveKnown = knownWords.length >= 40 ? knownWords : inBand.slice(0, 60);

  const ratio = profile.new_word_ratio ?? 0.05;
  const targetWords = selectTargets({
    candidates,
    count: targetCountFor(level, ratio),
  });

  const dueIds = new Set(
    (words ?? []).filter((w) => w.status === "learning").map((w) => w.lexeme_id),
  );

  try {
    const doc = await generateText({
      level,
      knownWords: selectKnown({ known: effectiveKnown, level, dueIds }),
      knownIds: new Set([...knownIds, ...effectiveKnown.map((e) => e.id)]),
      targetWords,
      newWordRatio: ratio,
      theme,
    });
    // A text that teaches nothing is one the pool will reject on every future
    // visit, so caching it means the learner asks for another one forever and
    // each attempt leaves another unusable row behind. `generateText` already
    // refuses to return one, so this is a belt-and-braces guard on the cache.
    if (doc.newWords.length === 0) {
      return NextResponse.json({ error: "generated text teaches nothing" }, { status: 502 });
    }
    await insertGeneratedText(supabaseService(), doc, vocabHash(doc), theme);
    return NextResponse.json({ created: true, id: doc.id });
  } catch (e: unknown) {
    console.error("API /generate error:", e);
    return NextResponse.json(
      { error: (e as Error)?.message || String(e) || "generation failed" },
      { status: 502 },
    );
  }
}
