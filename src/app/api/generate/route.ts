import { NextResponse } from "next/server";
import { generateText, vocabHash } from "@/lib/ai/generate";
import { lexicon, levelById } from "@/lib/content/load";
import { assumedKnown, placementCredit } from "@/lib/content/text-pool";
import { isTeachable } from "@/lib/content/teachability";
import {
  coldStartKnown,
  isBeginnerLevel,
  selectKnown,
  selectTargets,
  targetCountFor,
  teachablePool,
} from "@/lib/content/word-selection";
import { insertGeneratedText } from "@/lib/db/texts";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export const maxDuration = 60;

/** The themes the reader can ask for. Also the allow-list for the request body. */
const THEMES = [
  "Daily Life",
  "Food",
  "Travel",
  "Work",
  "Folktales",
  "Family",
  "Shopping",
  "Friendship",
] as const;

/**
 * Ensure the signed-in user has at least `want` unread texts at their level.
 * Generates (and caches, shared across users) only when the pool runs dry.
 */
export async function POST(req: Request) {
  let theme: string | undefined;
  let force = false;
  try {
    const body = await req.json();
    // The theme is interpolated straight into the prompt and then stored on a
    // row other learners read, so it is checked against the list the UI can
    // actually send rather than trusted. Unvalidated, one request could carry
    // an arbitrarily long string into three model calls and exhaust the shared
    // free-tier quota for every user of the deployment.
    if (typeof body?.theme === "string" && THEMES.includes(body.theme)) theme = body.theme;
    force = body?.force === true;
  } catch {
    // A malformed body is not worth failing on; the defaults below apply.
  }

  // No theme means "surprise me", so pick one rather than leaving it open.
  theme ??= THEMES[Math.floor(Math.random() * THEMES.length)];

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

  const { data: pool } = await db.from("texts").select("id, theme, doc").eq("level", level.id);
  const unread = (pool ?? []).filter((t) => !readIds.has(t.id));
  
  // `theme` is always set by this point, so there is no unthemed branch.
  if (!force) {
    const unreadThemed = unread.filter((t) => t.theme === theme);
    if (unreadThemed.length > 0) {
      return NextResponse.json({ created: false, unread: unreadThemed.length });
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

  const knownWords = lexicon.entries.filter((e) => knownIds.has(e.id));
  // In-band by frequency, plus the curated beginner core at the first levels.
  // An entry whose gloss is "[C2 auto-fill]" is excluded either way: it can be
  // read but not taught, since the prompt would ask for it by that name and the
  // review card would answer with it.
  const candidates = teachablePool(
    lexicon.entries,
    level,
    (e) => knownIds.has(e.id),
    isTeachable,
  );

  // A brand-new learner has nothing yet, so fall back to a starting vocabulary
  // rather than an empty constraint. It used to be `inBand.slice(0, 60)` - the
  // sixty commonest words in the language, `de, ser, el, la, que, a, i, no` -
  // which is the worst possible opening vocabulary and was what every new user
  // got. `coldStartKnown` leads with the beginner core instead.
  const effectiveKnown =
    knownWords.length >= 40 ? knownWords : coldStartKnown(lexicon.entries, level, isTeachable);

  const ratio = profile.new_word_ratio ?? 0.05;
  const targetWords = selectTargets({
    candidates,
    count: targetCountFor(level, ratio),
    preferBeginnerCore: isBeginnerLevel(level),
  });

  if (targetWords.length === 0) {
    return NextResponse.json({ error: "no teachable words left at this level" }, { status: 409 });
  }

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
      // What this level already has, so the pool stops converging on the same
      // few stories.
      avoidTitles: (pool ?? [])
        .map((t) => (t.doc as { titleEn?: string } | null)?.titleEn)
        .filter((t): t is string => !!t)
        .slice(-8),
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
    // Logged in full, reported in brief: the message can carry provider names,
    // model ids and a slice of the upstream response body, and the reader
    // renders it verbatim to the learner.
    console.error("API /generate error:", e);
    return NextResponse.json({ error: "Could not write a new text right now." }, { status: 502 });
  }
}
