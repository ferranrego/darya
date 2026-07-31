const fs = require('fs');

// 1. Fix lexicon duplicates
const LEXICON_PATH = 'content/ca/lexicon/lexicon.json';
const lexData = JSON.parse(fs.readFileSync(LEXICON_PATH, 'utf8'));

const seenMatchKeys = new Set();
const entriesToKeep = [];

for (const entry of lexData.entries) {
  // If target is duplicate (the match key is usually just target normalized)
  const key = entry.targetNormalized;
  if (seenMatchKeys.has(key)) {
    console.log(`Removing duplicate lexicon entry: ${key}`);
    continue;
  }
  seenMatchKeys.add(key);
  entriesToKeep.push(entry);
}
lexData.entries = entriesToKeep;
fs.writeFileSync(LEXICON_PATH, JSON.stringify(lexData, null, 2), 'utf8');

// 2. Fix grammar duplicates and highlights
const ALL_JSON_PATH = 'content/ca/grammar/all.json';
const grammarData = JSON.parse(fs.readFileSync(ALL_JSON_PATH, 'utf8'));

let exCounter = 1;

for (const course of grammarData.courses) {
  for (const block of course.blocks) {
    for (const lesson of block.lessons) {
      
      // Fix exercises IDs
      for (let i = 0; i < lesson.exercises.length; i++) {
        const ex = lesson.exercises[i];
        // Ensure globablly unique ID for exercise
        ex.id = `${lesson.id}_ex_${i + 1}`;
        
        // Also strip the punctuation warnings for the target word if it's there
        if (ex.target) {
          ex.target = ex.target.replace(/[.,?!;:()'"]/g, '');
        }
      }
      
      // Fix highlights
      for (const slide of lesson.slides) {
        for (const ex of slide.examples) {
          if (ex.highlight) {
            if (ex.highlight === "Em penedeixo de") ex.highlight = "Em penedeixo d'";
            if (ex.highlight === "el, el llibre") ex.highlight = "El";
            if (ex.highlight === "Li, a la Maria") ex.highlight = "Li";
          }
        }
      }
    }
  }
}

fs.writeFileSync(ALL_JSON_PATH, JSON.stringify(grammarData, null, 2), 'utf8');
console.log('Fixed duplicate exercise IDs and highlights in grammar.');
