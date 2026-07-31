import fs from 'fs';
const data = JSON.parse(fs.readFileSync('content/ca/lexicon/lexicon.json', 'utf8'));
const newWords = data.entries.filter(w => {
  const num = parseInt(w.id.replace('lx-', ''), 10);
  return num >= 883 && num <= 1064;
});
console.log(JSON.stringify(newWords, null, 2));
