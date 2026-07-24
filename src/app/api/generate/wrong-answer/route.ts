import { supabaseServer, supabaseService } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { explainWrongAnswer } from "@/lib/ai/wrong-answer";
import type { ExerciseData } from "@/lib/ai/exercises";

export async function POST(req: Request) {
  try {
    const { exerciseId, exerciseData, chosenAnswer } = await req.json();

    if (!exerciseId || !exerciseData || !chosenAnswer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const db = await supabaseServer();

    // 1. Check shared cache
    const { data: cached } = await db
      .from("wrong_answer_explanations")
      .select("explanation_en")
      .eq("exercise_id", exerciseId)
      .eq("chosen_answer", chosenAnswer)
      .single();

    if (cached) {
      return NextResponse.json({
        explanationEn: cached.explanation_en,
        cached: true,
      });
    }

    // 2. Generate
    const explanationEn = await explainWrongAnswer(exerciseData as ExerciseData, chosenAnswer);

    // 3. Cache it (fire and forget is fine, but we'll await to be safe)
    const srv = supabaseService();
    await srv.from("wrong_answer_explanations").insert({
      exercise_id: exerciseId,
      chosen_answer: chosenAnswer,
      explanation_en: explanationEn,
    });

    return NextResponse.json({ explanationEn, cached: false });
  } catch (error) {
    console.error("Error generating wrong answer explanation:", error);
    return NextResponse.json(
      { error: "Failed to generate explanation" },
      { status: 500 }
    );
  }
}
