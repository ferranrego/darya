import { generateContextSentences } from "./src/lib/ai/context-sentences";

async function run() {
  console.log("Testing context sentence generation...");
  
  // Test with a common Dari word: "bread" (naan)
  const wordDari = "نان";
  const wordTranslit = "nān";
  const wordEn = "bread";

  try {
    const sentences = await generateContextSentences(wordDari, wordTranslit, wordEn, 3);
    console.log("\nSuccess! Generated sentences:\n");
    sentences.forEach((s, i) => {
      console.log(`${i + 1}. ${s.dari}`);
      console.log(`   ${s.translit}`);
      console.log(`   ${s.en}\n`);
    });
  } catch (error) {
    console.error("Error during generation:", error);
  }
}

run();
