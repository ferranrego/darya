const fs = require('fs');
const path = 'content/ca/lexicon/homograph-review.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const correctReviews = [
  { "surface": "dona", "correctLexemeId": "lx-0071", "reason": "Used as the noun 'woman'." },
  { "surface": "calent", "correctLexemeId": "lx-0232", "reason": "Used as the adjective 'hot'." },
  { "surface": "neta", "correctLexemeId": "lx-0906", "reason": "Used as the adjective 'clean'." },
  { "surface": "obert", "correctLexemeId": "lx-0883", "reason": "Used as the adjective 'open'." },
  { "surface": "pregunta", "correctLexemeId": "lx-0314", "reason": "Used as the noun 'question'." },
  { "surface": "nena", "correctLexemeId": "lx-0907", "reason": "Used as the noun 'girl'." },
  { "surface": "tancat", "correctLexemeId": "lx-0884", "reason": "Used as the adjective 'closed'." },
  { "surface": "riu", "correctLexemeId": "lx-0577", "reason": "Used as the noun 'river'." },
  { "surface": "filla", "correctLexemeId": "lx-0903", "reason": "Used as the noun 'daughter'." },
  { "surface": "cuina", "correctLexemeId": "lx-0372", "reason": "Used as the noun 'kitchen'." },
  { "surface": "pantalons", "correctLexemeId": "lx-0431", "reason": "Used as the noun 'trousers'." },
  { "surface": "rosa", "correctLexemeId": "lx-4620", "reason": "Used as the noun/adjective 'pink'." },
  { "surface": "sec", "correctLexemeId": "lx-4617", "reason": "Used as the adjective 'dry'." },
  { "surface": "part", "correctLexemeId": "lx-0075", "reason": "Used as the noun 'part'." },
  { "surface": "cosa", "correctLexemeId": "lx-0076", "reason": "Used as the noun 'thing'." },
  { "surface": "estat", "correctLexemeId": "lx-1257", "reason": "Used as the noun 'state'." },
  { "surface": "mort", "correctLexemeId": "lx-4210", "reason": "Used as the noun 'death'." },
  { "surface": "cos", "correctLexemeId": "lx-0405", "reason": "Used as the noun 'body'." },
  { "surface": "cursa", "correctLexemeId": "lx-3954", "reason": "Used as the noun 'race'." },
  { "surface": "parella", "correctLexemeId": "lx-0912", "reason": "Used as the noun 'couple'." },
  { "surface": "vol", "correctLexemeId": "lx-1007", "reason": "Used as the noun 'flight'." }
];

for (const review of correctReviews) {
  if (!data.reviewed.find(r => r.surface === review.surface && r.correctLexemeId === review.correctLexemeId)) {
    data.reviewed.push(review);
  }
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log("Updated homograph-review.json");
