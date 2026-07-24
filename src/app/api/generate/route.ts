import { NextResponse } from "next/server";
import { generateText, vocabHash } from "@/lib/ai/generate";
import { lexicon, levelById } from "@/lib/content/load";
import { insertGeneratedText } from "@/lib/db/texts";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * Ensure the signed-in user has at least `want` unread texts at their level.
 * Generates (and caches, shared across users) only when the pool runs dry.
 */
export async function POST(req: Request) {
  let theme: string | undefined = undefined;
  try {
    const body = await req.json();
    theme = body?.theme;
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

  // Build the vocabulary constraint from the learner's actual words.
  const statusById = new Map((words ?? []).map((w) => [w.lexeme_id, w.status]));
  const inBand = lexicon.entries.filter((e) => level.freqBands.includes(e.freqBand));
  const knownWords = inBand.filter((e) => statusById.has(e.id));
  const newWords = inBand
    .filter((e) => !statusById.has(e.id))
    .sort((a, b) => a.freqRank - b.freqRank);

  // For brand-new learners the "known" set is empty, so fall back to the most
  // frequent words of the level so generation still works.
  const effectiveKnown = knownWords.length >= 15 ? knownWords : inBand.slice(0, 40);

  const ratio = profile.new_word_ratio ?? 0.05;
  const avgSentenceWords = 7;
  const expectedTokens = ((level.sentenceRange[0] + level.sentenceRange[1]) / 2) * avgSentenceWords;
  const targetCount = Math.max(2, Math.min(8, Math.round(expectedTokens * ratio)));
  const targetWords = newWords.slice(0, targetCount);

  try {
    const doc = await generateText({
      level,
      knownWords: effectiveKnown.slice(0, 120),
      targetWords,
      newWordRatio: ratio,
      theme,
    });
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
