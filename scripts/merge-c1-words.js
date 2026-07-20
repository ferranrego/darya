import fs from "fs";
import { join } from "path";
import { matchKey } from "../src/lib/text/normalize.ts";

const currentLexiconPath = join(import.meta.dirname, "..", "content", "lexicon", "lexicon.json");
const currentLexiconData = JSON.parse(fs.readFileSync(currentLexiconPath, "utf-8"));
const currentLexicon = currentLexiconData.entries;

const knownKeys = new Set(currentLexicon.map(e => matchKey(e.dari)));
currentLexicon.forEach(e => {
  if (e.variants) {
    e.variants.forEach(v => knownKeys.add(matchKey(v)));
  }
});

let currentRank = 4001;
const validWords = [];
const TARGET_WORDS = 2000; // From 4001 to 6000

for (let i = 1; i <= 16; i++) {
  const batchPath = join(import.meta.dirname, "..", "scratch", `c1-batch${i}.txt`);
  if (!fs.existsSync(batchPath)) {
    console.log(`Missing ${batchPath}`);
    continue;
  }
  
  const lines = fs.readFileSync(batchPath, "utf-8").split("\n");
  for (const line of lines) {
    if (!line.trim() || line.startsWith("#")) continue;
    
    const parts = line.split("|");
    if (parts.length < 11) continue;
    
    const dari = parts[1];
    const key = matchKey(dari);
    
    if (!knownKeys.has(key)) {
      parts[0] = currentRank.toString();
      validWords.push(parts);
      knownKeys.add(key);
      if (parts[10]) { // variants
        parts[10].split(",").forEach(v => knownKeys.add(matchKey(v.trim())));
      }
      currentRank++;
      
      if (validWords.length === TARGET_WORDS) {
        break;
      }
    }
  }
  if (validWords.length === TARGET_WORDS) break;
}

const outPath = join(import.meta.dirname, "data", "core-lexicon-9.txt");
const outLines = validWords.map(parts => parts.join("|"));
fs.writeFileSync(outPath, outLines.join("\n") + "\n");
console.log(`Wrote ${validWords.length} new C1 words (up to rank ${currentRank - 1})`);
