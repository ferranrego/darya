import { NextResponse } from "next/server";
import { generateExercises, taggedLexemes, FALLBACK_THEMES, type ExerciseData } from "@/lib/ai/exercises";
import { lexicon, levelById, lexemeById } from "@/lib/content/load";
import type { LexiconEntry } from "@/lib/content/schema";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { sample, shuffle } from "@/lib/util/shuffle";

export const maxDuration = 60;

const SESSION_SIZE = 5;
/** Weakest-learning-words window to sample targets from. */
const LEARNING_WINDOW = 8;
/** New-words frontier window to sample targets from. */
const NEW_WINDOW = 20;

interface ExerciseRow {
  id: string;
  type: string;
  data: ExerciseData;
  lexeme_ids: string[];
  level: string;
  created_at: string;
}

export async function POST() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [{ data: profile }, { data: words }] = await Promise.all([
    db.from("profiles").select("level_estimate").eq("id", user.id).single(),
    db.from("user_words").select("lexeme_id,status,due").eq("user_id", user.id),
  ]);
  if (!profile) {
    return NextResponse.json({ error: "no profile" }, { status: 400 });
  }

  const level = levelById(profile.level_estimate);
  const statusById = new Map((words ?? []).map((w) => [w.lexeme_id, w.status]));
  const inBand = lexicon.entries.filter((e) => level.freqBands.includes(e.freqBand));

  // Buckets: active SRS words (weakest first), consolidated words, and the
  // unseen frequency frontier.
  const learning = (words ?? [])
    .filter((w) => w.status === "learning")
    .sort((a, b) => (a.due ?? "").localeCompare(b.due ?? ""))
    .map((w) => lexemeById(w.lexeme_id))
    .filter((e): e is LexiconEntry => !!e);
  const known = inBand.filter((e) => statusById.get(e.id) === "known");
  const unseen = inBand
    .filter((e) => !statusById.has(e.id))
    .sort((a, b) => a.freqRank - b.freqRank);

  const knownWords = inBand.filter((e) => statusById.has(e.id));
  if (knownWords.length < 15) {
    console.log("Not enough vocab. Known:", knownWords.length);
    return NextResponse.json(
      { error: "not_enough_vocab", message: "You need to learn a few more words before practicing sentences!" },
      { status: 400 }
    );
  }

  // Targets rotate between sessions: 3 sampled from the weakest learning
  // words, 2 sampled from the next new words, backfilling either side.
  const learningTargets = sample(learning.slice(0, LEARNING_WINDOW), 3);
  const newTargets = sample(unseen.slice(0, NEW_WINDOW), 5 - learningTargets.length);
  if (learningTargets.length + newTargets.length < 5) {
    // Unseen frontier is dry - backfill from deeper in the learning queue.
    const extra = learning.filter((e) => !learningTargets.includes(e));
    learningTargets.push(...sample(extra, 5 - learningTargets.length - newTargets.length));
  }
  const targets = [...learningTargets, ...newTargets];
  const targetIds = new Set(targets.map((t) => t.id));
  console.log(
    "Targets - learning:", learningTargets.map((w) => w.target),
    "new:", newTargets.map((w) => w.target),
  );

  // Sentence fabric: a rotating sample of consolidated words (fall back to
  // every tracked word for accounts that are all-learning).
  const fabric = known.length >= 15 ? known : knownWords;
  const knownContext = shuffle(fabric).slice(0, 80);

  // Theme: a random tag from the sampled vocabulary, else a stock scenario.
  const tagPool = knownContext.flatMap((e) => e.tags ?? []);
  const theme = sample(tagPool.length > 0 ? tagPool : FALLBACK_THEMES, 1)[0];

  // Per-user pool: stored exercises for this level the user hasn't done yet.
  const [{ data: done }, { data: poolRows }] = await Promise.all([
    db.from("user_exercises").select("exercise_id").eq("user_id", user.id),
    db.from("exercises").select("*").eq("level", level.id).order("created_at", { ascending: false }).limit(200),
  ]);
  const doneIds = new Set((done ?? []).map((d) => d.exercise_id));
  const pool = ((poolRows ?? []) as ExerciseRow[]).filter((row) => !doneIds.has(row.id));
  const relevant = pool.filter((row) => row.lexeme_ids?.some((id) => targetIds.has(id)));
  const rest = pool.filter((row) => !relevant.includes(row));

  const poolPick = [...sample(relevant, SESSION_SIZE)];
  const freshCount = SESSION_SIZE - poolPick.length;

  // Recent sentences the model must not converge back onto.
  const avoidSentences = [...poolPick, ...pool.slice(0, 10)]
    .map((row) => {
      const d = row.data;
      if ("sentenceTarget" in d) return d.sentenceTarget;
      if ("correctSentenceTarget" in d) return d.correctSentenceTarget;
      return null;
    })
    .filter((s): s is string => !!s)
    .slice(0, 12);

  try {
    let session: ExerciseRow[] = [...poolPick];

    if (freshCount > 0) {
      const exercisesData = await generateExercises({
        level: level.id,
        knownWords: knownContext,
        learningTargets,
        newTargets,
        count: freshCount,
        theme,
        avoidSentences,
      });

      if (!exercisesData || exercisesData.length === 0) {
        throw new Error("AI failed to generate any exercises");
      }

      const rows = exercisesData.map((ex) => ({
        type: ex.type,
        data: ex,
        lexeme_ids: taggedLexemes(ex, targetIds),
        level: level.id,
      }));

      const srv = supabaseService();
      const { data: inserted, error } = await srv.from("exercises").insert(rows).select("*");
      if (error) {
        throw new Error(`DB insert failed: ${error.message}`);
      }
      
      session = [...session, ...((inserted ?? []) as ExerciseRow[])];
    }

    return NextResponse.json({ created: freshCount > 0, exercises: shuffle(session) });
  } catch (e) {
    console.error("Error in generate exercises:", e);
    // Generation is best-effort: fall back to unseen pool exercises.
    const fallback = [...shuffle(relevant), ...shuffle(rest)].slice(0, SESSION_SIZE);
    if (fallback.length > 0) {
      return NextResponse.json({ created: false, exercises: fallback });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "generation failed" },
      { status: 502 },
    );
  }
}
