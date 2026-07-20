import { NextResponse } from "next/server";
import { z } from "zod";
import { lexicon } from "@/lib/content/load";

const requestSchema = z.object({
  knownLetters: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { knownLetters } = requestSchema.parse(json);

    if (knownLetters.length === 0) {
      return NextResponse.json({ error: "No known letters" }, { status: 400 });
    }

    // Convert known letters to a set for fast lookup
    // Note: This is a simplified check. A true Persian/Dari word check would
    // strip ZWNJ, spaces, and handle initial/medial/final forms if they were distinct Unicode chars,
    // but the standard Arabic block uses the same base character.
    const knownSet = new Set(knownLetters);
    // Add common non-letter characters that might appear
    knownSet.add(" ");
    knownSet.add("‌"); // ZWNJ

    // Find words that only use known letters
    const availableWords = lexicon.entries.filter((entry) => {
      // Very basic check: every character in the dari word must be in the known set
      const chars = Array.from(entry.dariNormalized || entry.dari);
      return chars.every((c) => knownSet.has(c));
    });

    if (availableWords.length < 3) {
      return NextResponse.json({ error: "Not enough vocabulary unlocked to form sentences." }, { status: 400 });
    }

    // Pick 3-4 random words to form a "sentence" (pseudo-sentence)
    const sentenceLength = Math.floor(Math.random() * 2) + 3; // 3 or 4
    const selected = [];
    for (let i = 0; i < sentenceLength; i++) {
      const idx = Math.floor(Math.random() * availableWords.length);
      selected.push(availableWords[idx]);
    }

    // Construct the pseudo-sentence
    const dari = selected.map(w => w.dari).join(" ");
    const translit = selected.map(w => w.translit).join(" ");
    const en = selected.map(w => w.glossEn).join(" ");

    return NextResponse.json({
      id: "gen-" + Date.now(),
      type: "readSentence",
      dari,
      translit,
      en: `(Pseudo) ${en}`,
    });
  } catch (err: any) {
    console.error("Alphabet Reading generation failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
