import fs from "fs";
import { join } from "path";

// normalize matching key
function matchKey(word) {
  if (!word) return "";
  return word.replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/آ/g, "ا")
    .replace(/\s+/g, "")
    .replace(/‌/g, "")
    .trim();
}

const lexiconPath = join(import.meta.dirname, "..", "content", "lexicon", "lexicon.json");
const currentLexiconData = JSON.parse(fs.readFileSync(lexiconPath, "utf8"));
const currentLexicon = currentLexiconData.entries;
const knownKeys = new Set(currentLexicon.map(e => matchKey(e.dari)));
currentLexicon.forEach(e => {
  if (e.variants) {
    e.variants.forEach(v => knownKeys.add(matchKey(v)));
  }
});

let validCount = 0;
const validWords = [];
const TARGET_WORDS = 1500; // From 2500 to 4000

for (let i = 1; i <= 14; i++) {
  const batchPath = join(import.meta.dirname, "..", "scratch", `b2-batch${i}.txt`);
  if (!fs.existsSync(batchPath)) {
    console.log(`Missing ${batchPath}`);
    continue;
  }
  const lines = fs.readFileSync(batchPath, "utf8").split("\n");
  for (const line of lines) {
    if (!line.trim() || line.startsWith("#")) continue;
    const parts = line.split("|");
    if (parts.length < 11) continue;
    
    if (validCount >= TARGET_WORDS) break;
    const dari = parts[1];
    const key = matchKey(dari);
    if (!knownKeys.has(key) && key !== "یاس") {
      validWords.push(parts);
      knownKeys.add(key);
      if (parts[10]) {
         parts[10].split(",").forEach(v => knownKeys.add(matchKey(v)));
      }
      validCount++;
    }
  }
}

let out = "# Darya core lexicon — B2 batch (AI scripted)\n# rank|dari|translit|pos|register|glossEn|exampleDari|exampleTranslit|exampleEn|tags|variants\n";
let currentRank = currentLexicon.length + 1;
for (const parts of validWords) {
  parts[0] = currentRank; // overwrite rank
  out += parts.join("|") + "\n";
  currentRank++;
}

fs.writeFileSync(join(import.meta.dirname, "data", "core-lexicon-8.txt"), out);
console.log(`Wrote ${validWords.length} new B2 words (up to rank ${currentRank - 1})`);
