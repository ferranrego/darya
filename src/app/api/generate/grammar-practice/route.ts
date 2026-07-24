import { NextResponse } from "next/server";
import { z } from "zod";
import { generatePracticeBatch, PRACTICE_BATCH_SIZE } from "@/lib/ai/grammar-practice";
import { grammarLessonById } from "@/lib/content/load";
import type { GrammarExercise } from "@/lib/content/schema";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { shuffle } from "@/lib/util/shuffle";

export const maxDuration = 60;

const requestSchema = z.object({
  lessonId: z.string(),
  /** Practice item ids already played this session (session-level dedupe). */
  excludeIds: z.array(z.number()).default([]),
});

interface PracticeRow {
  id: number;
  exercise: GrammarExercise;
}

/**
 * Serve extra practice for a grammar lesson from the shared Postgres pool;
 * generate (and cache for everyone) only when the pool runs dry.
 */
export async function POST(req: Request) {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let lessonId: string;
  let excludeIds: number[];
  try {
    ({ lessonId, excludeIds } = requestSchema.parse(await req.json()));
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const lesson = grammarLessonById(lessonId);
  if (!lesson) return NextResponse.json({ error: "unknown lesson" }, { status: 404 });

  const { data: pool, error } = await db
    .from("grammar_practice")
    .select("id,exercise")
    .eq("lesson_id", lessonId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const excluded = new Set(excludeIds);
  const unseen = ((pool ?? []) as PracticeRow[]).filter((row) => !excluded.has(row.id));

  if (unseen.length >= PRACTICE_BATCH_SIZE) {
    const picked = shuffle(unseen).slice(0, PRACTICE_BATCH_SIZE);
    return NextResponse.json({ items: picked, generated: false });
  }

  try {
    const batch = await generatePracticeBatch(lesson);
    const { data: inserted, error: insertError } = await supabaseService()
      .from("grammar_practice")
      .insert(batch.exercises.map((exercise) => ({ lesson_id: lessonId, exercise, model: batch.model })))
      .select("id,exercise");
    if (insertError) throw insertError;
    return NextResponse.json({ items: inserted as PracticeRow[], generated: true });
  } catch (e) {
    // Generation is best-effort: fall back to whatever unseen items exist.
    if (unseen.length > 0) {
      return NextResponse.json({ items: shuffle(unseen), generated: false });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "generation failed" },
      { status: 502 },
    );
  }
}
