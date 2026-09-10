import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { generateExercises, taggedLexemes, FALLBACK_THEMES, type ExerciseData } from "@/lib/ai/exercises";
import { buildFreeExercises } from "@/lib/content/free-exercises";
import { lexicon, levelById, lexemeById } from "@/lib/content/load";
import { textDocumentSchema, type LexiconEntry, type TextDocument } from "@/lib/content/schema";
import { stickingPoints } from "@/lib/db/errors";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { sample, shuffle } from "@/lib/util/shuffle";

export const maxDuration = 60;

const SESSION_SIZE = 5;
/** Weakest-learning-words window to sample targets from. */
const LEARNING_WINDOW = 8;
/** New-words frontier window to sample targets from. */
const NEW_WINDOW = 20;
/**
 * How many of the learner's own sticking points lead the target list.
 *
 * Not the whole session: a queue made only of failures is demoralising, and
 * the frequency frontier still has to advance. Three of five leaves room for
 * the normal mix and is the same split the learning/new sampling already uses.
 */
const STICKING_POINT_TARGETS = 3;

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

  const [{ data: profile }, { data: words }, sticking] = await Promise.all([
    db.from("profiles").select("level_estimate").eq("id", user.id).single(),
    db.from("user_words").select("lexeme_id,status,due").eq("user_id", user.id),
    // What they have got wrong and not yet got right again. Empty for a new
    // learner, and empty if the read fails - see stickingPoints.
    stickingPoints(db, user.id),
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
  // Everything they have met, in band or not: a seed sentence is only usable
  // as an exercise if every other word in it is one they already know, and
  // restricting that to the current band would reject most of the corpus.
  const trackedWords = [...statusById.keys()]
    .map((id) => lexemeById(id))
    .filter((e): e is LexiconEntry => !!e);
  if (knownWords.length < 15) {
    console.log("Not enough vocab. Known:", knownWords.length);
    return NextResponse.json(
      { error: "not_enough_vocab", message: "You need to learn a few more words before practicing sentences!" },
      { status: 400 }
    );
  }

  // Words with open mistakes come first, worst first. This is the whole point
  // of keeping the mistake record: a teacher re-teaches what you got wrong,
  // and until now the app could not. Nothing here touches the review
  // scheduler - the FSRS intervals are evidence about memory and must not be
  // rewritten by what practice happens to serve.
  const stickingTargets = sticking
    .map((s) => lexemeById(s.lexemeId))
    .filter((e): e is LexiconEntry => !!e)
    .slice(0, STICKING_POINT_TARGETS);

  // Targets rotate between sessions: 3 sampled from the weakest learning
  // words, 2 sampled from the next new words, backfilling either side.
  const learningTargets = [
    ...stickingTargets,
    ...sample(
      learning.filter((e) => !stickingTargets.some((s) => s.id === e.id)),
      Math.max(0, 3 - stickingTargets.length),
    ),
  ];
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
    "re-teaching:", stickingTargets.map((w) => w.target),
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

  const sentenceOf = (row: ExerciseRow): string | null => {
    const d = row.data;
    if ("sentenceTarget" in d) return d.sentenceTarget;
    if ("correctSentenceTarget" in d) return d.correctSentenceTarget;
    return null;
  };

  // Every sentence this level already has an exercise for, done or not. Used
  // to stop the seed-text builder storing a second exercise on a sentence that
  // already has one - the pool is shared by every learner at this level.
  const usedSentences = new Set(
    ((poolRows ?? []) as ExerciseRow[]).map(sentenceOf).filter((s): s is string => !!s),
  );

  // Recent sentences the model must not converge back onto.
  const avoidSentences = [...poolPick, ...pool.slice(0, 10)]
    .map(sentenceOf)
    .filter((s): s is string => !!s)
    .slice(0, 12);

  try {
    let session: ExerciseRow[] = [...poolPick];
    let missing = SESSION_SIZE - session.length;

    // Free first, AI only when the free content is dry.
    //
    // Every word in a seed text is already linked to a lexeme by the build,
    // which fails on any word it cannot resolve - so an exercise cut out of one
    // is in-vocabulary by construction, with no generation, no repair pass and
    // no retry. Five free-tier provider quotas are shared by every learner of
    // this deployment, so a session that costs nothing is a session that cannot
    // exhaust the day for somebody else.
    //
    // Built exercises are stored like any other, so this is a one-time cost per
    // sentence for the whole deployment rather than per learner: the second
    // learner to reach this level finds them already in the pool.
    if (missing > 0) {
      const built = await topUpFromSeedText({
        db,
        level: level.id,
        targetIds: [...stickingTargets, ...learningTargets, ...newTargets].map((e) => e.id),
        known: trackedWords,
        avoid: usedSentences,
        count: missing,
      });
      session = [...session, ...built];
      missing = SESSION_SIZE - session.length;
      console.log("Free exercises from seed text:", built.length);
    }

    const freshCount = missing;
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


/**
 * Fill a session from seed text, storing what it builds.
 *
 * Returns stored rows rather than bare exercises so the caller can treat them
 * exactly like generated ones - the same table, the same "already done" check,
 * the same recording of results. If the insert fails, this returns nothing and
 * the caller falls through to generation: a broken free path must never cost a
 * learner their practice session.
 */
async function topUpFromSeedText(args: {
  db: SupabaseClient;
  level: string;
  targetIds: string[];
  known: LexiconEntry[];
  avoid: Set<string>;
  count: number;
}): Promise<ExerciseRow[]> {
  const { db, level, targetIds, known, avoid, count } = args;
  try {
    const { data, error } = await db
      .from("texts")
      .select("doc")
      .eq("level", level)
      .eq("source", "seed");
    if (error || !data) return [];

    const docs: TextDocument[] = [];
    for (const row of data as { doc: unknown }[]) {
      const parsed = textDocumentSchema.safeParse(row.doc);
      // A text that no longer matches the schema is skipped, not fatal: this
      // path is an optimisation, and one stale cached row must not take the
      // whole session down with it.
      if (parsed.success) docs.push(parsed.data);
    }
    if (docs.length === 0) return [];

    const built = buildFreeExercises({
      docs,
      targetLexemeIds: targetIds,
      known,
      count,
      rand: Math.random,
    }).filter((ex) => {
      const sentence = "sentenceTarget" in ex.data ? ex.data.sentenceTarget : null;
      if (!sentence || avoid.has(sentence)) return false;
      // Two exercises in one batch can be cut from the same sentence only if
      // the builder let them through; keep the set authoritative either way.
      avoid.add(sentence);
      return true;
    });
    if (built.length === 0) return [];

    const srv = supabaseService();
    const { data: inserted, error: insertError } = await srv
      .from("exercises")
      .insert(
        built.map((ex) => ({
          type: ex.data.type,
          data: ex.data,
          lexeme_ids: [ex.lexemeId],
          level,
          source: "seed-text",
        })),
      )
      .select("*");
    if (insertError) {
      console.error("Free exercise insert failed:", insertError.message);
      return [];
    }
    return (inserted ?? []) as ExerciseRow[];
  } catch (e) {
    console.error("Free exercise build failed:", e);
    return [];
  }
}
