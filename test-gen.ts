import { generateText } from "./src/lib/ai/generate.ts";
import { levels, lexicon } from "./src/lib/content/load.ts";
import { config } from "dotenv";

config({ path: ".env.local" });

async function run() {
  const l1 = levels.find(l => l.id === "L1")!;
  const l2 = levels.find(l => l.id === "L2")!;
  const l4 = levels.find(l => l.id === "L4")!;

  console.log("Validating L1 (6 words/sentence, no conjunctions) with 25% new words...");
  try {
    const doc1 = await generateText({
      level: l1,
      knownWords: lexicon.entries.slice(0, 10),
      knownIds: new Set(lexicon.entries.slice(0, 10).map(e => e.id)),
      targetWords: lexicon.entries.slice(10, 13), // 3 target words
      newWordRatio: 0.25,
      theme: "Greetings"
    });
    console.log("L1 SUCCESS:", doc1.titleTarget);
    console.log(doc1.sentences.map(s => s.target));
    console.log("Target words requested:", 3, "New words got:", doc1.newWords.length);
  } catch (e) { console.error("L1 FAILED:", e); }

  console.log("\nValidating L4 (normal density) with 5% new words...");
  try {
    const doc4 = await generateText({
      level: l4,
      knownWords: lexicon.entries.slice(0, 100),
      knownIds: new Set(lexicon.entries.slice(0, 100).map(e => e.id)),
      targetWords: lexicon.entries.slice(100, 105), // 5 target words
      newWordRatio: 0.05,
      theme: "Work"
    });
    console.log("L4 SUCCESS:", doc4.titleTarget);
    console.log(doc4.sentences.map(s => s.target));
    console.log("Target words requested:", 5, "New words got:", doc4.newWords.length);
  } catch (e) { console.error("L4 FAILED:", e); }
}

run();
