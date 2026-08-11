const fs = require('fs');
const path = 'content/ca/lexicon/homograph-review.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const newReviews = [
  { "surface": "partit", "correctLexemeId": "lx-0973", "reason": "Used as the noun 'match/party'." },
  { "surface": "pla", "correctLexemeId": "lx-0864", "reason": "Used as the noun 'plan'." },
  { "surface": "dit", "correctLexemeId": "lx-0890", "reason": "Used as the noun 'finger'." },
  { "surface": "causa", "correctLexemeId": "lx-1357", "reason": "Used as the noun 'cause'." },
  { "surface": "veu", "correctLexemeId": "lx-2948", "reason": "Used as the noun 'voice'." },
  { "surface": "prova", "correctLexemeId": "lx-1135", "reason": "Used as the noun 'evidence'." },
  { "surface": "cara", "correctLexemeId": "lx-0887", "reason": "Used as the noun 'face'." },
  { "surface": "baixa", "correctLexemeId": "lx-2374", "reason": "Used as the noun 'sick leave'." },
  { "surface": "conegut", "correctLexemeId": "lx-3824", "reason": "Used as the noun 'acquaintance'." },
  { "surface": "assassinat", "correctLexemeId": "lx-1127", "reason": "Used as the noun 'murder'." },
  { "surface": "política", "correctLexemeId": "lx-1280", "reason": "Used as the noun 'politics'." },
  { "surface": "sala", "correctLexemeId": "lx-0701", "reason": "Used as the noun 'room'." },
  { "surface": "resultat", "correctLexemeId": "lx-0782", "reason": "Used as the noun 'result'." }
];

for (const review of newReviews) {
  if (!data.reviewed.find(r => r.surface === review.surface && r.correctLexemeId === review.correctLexemeId)) {
    data.reviewed.push(review);
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log("Updated homograph-review.json with L2 words");
