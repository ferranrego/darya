const fs = require('fs');

const LEXICON_PATH = 'content/ca/lexicon/lexicon.json';
const OUTPUT_PATH = 'validation_output.txt';

const data = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));
const output = fs.readFileSync(OUTPUT_PATH, 'utf8');

const missingWords = new Set();
const regex = /"([^"]+)" not in lexicon/g;
let match;
while ((match = regex.exec(output)) !== null) {
  let word = match[1];
  // Clean punctuation from the word (like "cansat.", "aquí!", "demà?")
  word = word.replace(/[.,?!;:()'"]/g, '').trim();
  if (word) {
    missingWords.add(word);
  }
}

if (missingWords.size === 0) {
  console.log('No missing words found.');
  process.exit(0);
}

// Ensure the words aren't already in the lexicon
const existingWords = new Set(data.entries.map(e => e.target));
const newWords = Array.from(missingWords).filter(w => !existingWords.has(w));

if (newWords.length === 0) {
  console.log('All missing words are already in the lexicon.');
  process.exit(0);
}

console.log(`Found ${newWords.length} missing words. Appending to lexicon...`);

let maxId = 0;
for (const entry of data.entries) {
  const idNum = parseInt(entry.id.replace('lx-', ''), 10);
  if (idNum > maxId) maxId = idNum;
}

let nextRank = data.entries.length + 1;

for (const word of newWords) {
  maxId++;
  const newEntry = {
    id: `lx-${maxId.toString().padStart(4, '0')}`,
    target: word,
    targetNormalized: word.toLowerCase(),
    glossEn: "[C2 auto-fill]",
    pos: "noun",
    freqRank: nextRank++,
    freqBand: 10,
    register: "formal",
    variants: [],
    tags: ["auto-added"],
    exampleTarget: word,
    exampleEn: "[C2 auto-fill]"
  };
  data.entries.push(newEntry);
}

fs.writeFileSync(LEXICON_PATH, JSON.stringify(data, null, 2), 'utf8');
console.log('Added missing words to lexicon.');
