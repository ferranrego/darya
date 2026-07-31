import { describe, it, expect } from "vitest";
import { generateText } from "./generate.ts";
import { levels, lexicon } from "../content/load.ts";

describe("live generation", () => {
  it("generates L1 texts successfully", async () => {
    const l1 = levels.find(l => l.id === "L1")!;
    const inBand = lexicon.entries.filter(e => l1.freqBands.includes(e.freqBand));
    const known = inBand.slice(0, 100);
    const targets = inBand.slice(100, 103);
    
    const doc = await generateText({
      level: l1,
      knownWords: known,
      knownIds: new Set(known.map(e => e.id)),
      targetWords: targets, // 3 targets
      newWordRatio: 0.25,
      theme: "Greetings"
    });
    console.log("L1 SUCCESS:", doc.titleTarget);
    console.log(doc.sentences.map(s => s.target));
    expect(doc.newWords.length).toBeGreaterThanOrEqual(3);
  }, 120000);

  it("generates L3 texts successfully", async () => {
    const l3 = levels.find(l => l.id === "L3")!;
    const inBand = lexicon.entries.filter(e => l3.freqBands.includes(e.freqBand));
    const known = inBand.slice(0, 500);
    const targets = inBand.slice(500, 504);

    const doc = await generateText({
      level: l3,
      knownWords: known,
      knownIds: new Set(known.map(e => e.id)),
      targetWords: targets, // 4 targets
      newWordRatio: 0.05,
      theme: "Work"
    });
    console.log("L3 SUCCESS:", doc.titleTarget);
    console.log(doc.sentences.map(s => s.target));
    expect(doc.newWords.length).toBeGreaterThanOrEqual(4);
  }, 120000);
});
