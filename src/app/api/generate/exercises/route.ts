import { NextResponse } from "next/server";
import { generateExercises } from "@/lib/ai/exercises";
import { lexicon, levelById } from "@/lib/content/load";
import { supabaseServer, supabaseService } from "@/lib/supabase/server";

export const maxDuration = 60;

export async function POST() {
  const db = await supabaseServer();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    console.log("User not found or unauthorized");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  console.log("User found:", user.id);

  const [{ data: profile }, { data: words }] = await Promise.all([
    db.from("profiles").select("level_estimate").eq("id", user.id).single(),
    db.from("user_words").select("lexeme_id,status").eq("user_id", user.id),
  ]);
  if (!profile) {
    console.log("Profile not found");
    return NextResponse.json({ error: "no profile" }, { status: 400 });
  }
  console.log("Profile level:", profile.level_estimate, "Words count:", words?.length);

  const level = levelById(profile.level_estimate);
  
  // We want a mix of known words and some target new words.
  const statusById = new Map((words ?? []).map((w) => [w.lexeme_id, w.status]));
  const inBand = lexicon.entries.filter((e) => level.freqBands.includes(e.freqBand));
  
  const knownWords = inBand.filter((e) => statusById.has(e.id));
  const newWords = inBand
    .filter((e) => !statusById.has(e.id))
    .sort((a, b) => a.freqRank - b.freqRank);

  if (knownWords.length < 15) {
    console.log("Not enough vocab. Known:", knownWords.length);
    return NextResponse.json(
      { error: "not_enough_vocab", message: "You need to learn a few more words before practicing sentences!" },
      { status: 400 }
    );
  }

  const effectiveKnown = knownWords;
  const targetWords = newWords.slice(0, 5); // Pick 5 new words to focus on
  console.log("Target words:", targetWords.map(w => w.dari));

  try {
    console.log("Calling AI generateExercises...");
    const exercisesData = await generateExercises({
      level: level.id,
      knownWords: effectiveKnown.slice(0, 100), // Cap context to avoid massive prompts
      targetWords,
      count: 5, // Generate 5 exercises at a time
    });

    if (!exercisesData || exercisesData.length === 0) {
      console.log("AI returned 0 exercises");
      throw new Error("AI failed to generate any exercises");
    }

    console.log("AI returned exercises:", exercisesData.length);

    const rows = exercisesData.map((ex) => {
      // Find which target lexemes were used (basic string match on Dari)
      const usedLexemes = targetWords.filter(tw => 
        JSON.stringify(ex).includes(tw.dari)
      ).map(tw => tw.id);

      return {
        type: ex.type,
        data: ex,
        lexeme_ids: usedLexemes,
        level: level.id,
      };
    });

    const srv = supabaseService();
    const { data: inserted, error } = await srv.from("exercises").insert(rows).select("*");
    
    if (error) {
      console.error("DB insert failed:", error);
      throw new Error(`DB insert failed: ${error.message}`);
    }

    console.log("Successfully inserted exercises:", inserted?.length);
    return NextResponse.json({ created: true, exercises: inserted });
  } catch (e) {
    console.error("Error in generate exercises:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "generation failed" },
      { status: 502 },
    );
  }
}
