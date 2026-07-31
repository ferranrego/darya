import { NextResponse } from "next/server";
import { generateText, vocabHash } from "@/lib/ai/generate";
import { levels, lexicon, levelById } from "@/lib/content/load";
import type { LexiconEntry, Level } from "@/lib/content/schema";
import { assumedKnown } from "@/lib/content/text-pool";
import { insertGeneratedText } from "@/lib/db/texts";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export const maxDuration = 60;

/**
 * How many known words the model is shown, by level.
 *
 * This was a flat `.slice(0, 160)` taken in lexicon order, which is two bugs at
 * once. A learner who knows three thousand words was described to the model as
 * knowing an arbitrary hundred and sixty of them, so upper-level texts came out
 * unnaturally impoverished - and, worse, the model had to reach outside the
 * list to say anything at all, which inflated the out-of-vocabulary rate that
 * the pool then measures the text against. Loosening the OOV gate was the old
 * workaround; giving the model the vocabulary the learner actually has is the
 * fix.
 *
 * The cap is not unbounded: the list is prompt context on a free tier, and past
 * a few hundred words the model stops reading it carefully. Words are taken in
 * frequency order so the ones it does read are the ones worth reusing.
 */
function knownWordBudget(known: LexiconEntry[], level: Level): LexiconEntry[] {
  // Roughly the level's own vocabulary size, floored so early levels still get
  // enough to write with and ceilinged so the prompt stays affordable.
  const budget = Math.max(160, Math.min(600, Math.round(level.entryKnownWords * 0.5) || 160));
  return known.slice(0, budget);
}

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
  // against it - `assumedKnown` is the single definition of "words this learner
  // has". Counting only the rows the assessment created meant an A2 learner was
  // treated as knowing 17 words, and being told to write five sentences with 17
  // words is what produced "faig una aplicació al jardí": the model has to
  // break the constraint to say anything at all.
  const levelIdx = levels.findIndex((l) => l.id === level.id);
  const priorMaxRank = levelIdx >= 1 ? levels[levelIdx - 1].entryKnownWords : 0;
  const knownIds = assumedKnown(
    (words ?? [])
      .filter((w) => w.status === "known" || w.status === "learning")
      .map((w) => w.lexeme_id),
    lexicon.entries.filter((e) => e.freqRank <= priorMaxRank).map((e) => e.id),
  );

  const inBand = lexicon.entries.filter((e) => level.freqBands.includes(e.freqBand));
  const knownWords = inBand
    .filter((e) => knownIds.has(e.id))
    .sort((a, b) => a.freqRank - b.freqRank);
  const newWords = inBand
    .filter((e) => !knownIds.has(e.id))
    .sort((a, b) => a.freqRank - b.freqRank);

  // A brand-new learner at the first level has nothing yet, so fall back to the
  // most frequent words of the level rather than an empty constraint.
  const effectiveKnown = knownWords.length >= 40 ? knownWords : inBand.slice(0, 60);

  const ratio = profile.new_word_ratio ?? 0.05;
  // Sentences get longer with level, so a fixed 7 under-counted the token
  // budget at the top and over-counted it at the bottom. `sentenceLengthHint`
  // carries the real cap in prose; its midpoint is close enough and moves in
  // the right direction.
  const avgSentenceWords = Math.round((level.sentenceRange[0] + level.sentenceRange[1]) / 2) + 4;
  const expectedTokens = ((level.sentenceRange[0] + level.sentenceRange[1]) / 2) * avgSentenceWords;
  const targetCount = Math.max(2, Math.min(15, Math.round(expectedTokens * ratio)));

  const candidateTargetWords = newWords.slice(0, targetCount * 3);
  const targetWords = candidateTargetWords
    .sort(() => Math.random() - 0.5)
    .slice(0, targetCount);

  try {
    const doc = await generateText({
      level,
      knownWords: knownWordBudget(effectiveKnown, level),
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
