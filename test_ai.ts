import { generateExercises } from "./src/lib/ai/exercises";

async function run() {
  try {
    const data = await generateExercises({
      level: "beginner",
      knownWords: [{ dari: "من", translit: "man", glossEn: "I", id: "lx-0001", freqRank: 1, freqBand: 1 } as any],
      learningTargets: [],
      newTargets: [],
      count: 5
    });
    console.log("Success:", data);
  } catch(e) {
    console.error("Error:", e);
  }
}
run();
