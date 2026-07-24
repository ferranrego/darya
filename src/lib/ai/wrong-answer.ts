import { z } from "zod";
import { completeJson } from "./providers";
import type { ExerciseData } from "./exercises";

const wrongAnswerOutputSchema = z.object({
  explanationEn: z.string(),
});

export async function explainWrongAnswer(
  exercise: ExerciseData,
  chosenAnswer: string,
): Promise<string> {
  const prompt = `You are a Dari language teacher in Kabul. A student is doing a language exercise and has selected an incorrect answer.
Explain in ONE short, encouraging sentence (in English) why the answer they chose is incorrect. Do NOT give away the correct answer if you can avoid it, just explain the mistake.

Exercise Type: ${exercise.type}
${exercise.type === "cloze" ? `Sentence: ${exercise.sentenceDari}
Missing Word (Correct Answer): ${exercise.missingWord}
Student's Chosen Wrong Answer: ${chosenAnswer}` : ""}

Return ONLY JSON with this exact shape:
{
  "explanationEn": "..."
}`;

  return completeJson(prompt, {
    temperature: 0.2,
    validate: (raw) => {
      const parsed = wrongAnswerOutputSchema.parse(JSON.parse(raw));
      return parsed.explanationEn;
    },
  });
}
