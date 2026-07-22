import { NextResponse } from "next/server";
import { z } from "zod";
import { generateReadingSentence } from "@/lib/ai/alphabet-reading";

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

    const sentence = await generateReadingSentence(knownLetters);
    return NextResponse.json(sentence);
  } catch (err: any) {
    console.error("Alphabet Reading generation failed:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
