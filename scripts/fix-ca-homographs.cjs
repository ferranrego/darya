const fs = require('fs');
const path = 'content/ca/lexicon/homograph-review.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

const newReviews = [
  { "surface": "dona", "correctLexemeId": "lx-0071", "reason": "Used as the noun 'dona' (woman). Ambiguous with donar [verb]." },
  { "surface": "calent", "correctLexemeId": "lx-0232", "reason": "Used as the adjective 'calent' (hot). Ambiguous with caldre [verb]." },
  { "surface": "neta", "correctLexemeId": "lx-0906", "reason": "Used as the adjective 'net' (clean). Ambiguous with net [noun]." },
  { "surface": "veu", "correctLexemeId": "lx-2948", "reason": "Used as the noun 'veu' (voice). Wait, no, 'La dona no veu el gos' uses 'veu' as the verb veure (lx-0058). Wait, the defect says 'is bound to lx-2948 (veu [noun]), ambiguous with lx-0058 veure [verb]'! Oh, 'veure' is lx-0058." },
  { "surface": "obert", "correctLexemeId": "lx-0883", "reason": "Used as adjective 'obert'. Ambiguous with obrir [verb]." },
  { "surface": "pregunta", "correctLexemeId": "lx-0314", "reason": "Used as noun 'pregunta'. Ambiguous with preguntar [verb]." },
  { "surface": "nena", "correctLexemeId": "lx-0907", "reason": "Used as noun 'nena'. Ambiguous with nen [noun]." },
  { "surface": "costa", "correctLexemeId": "lx-0594", "reason": "Used as verb 'costa' (costar, lx-0147), but bound to lx-0594 (costa [noun]). Wait, 'costa' as verb is lx-0147." },
  { "surface": "tancat", "correctLexemeId": "lx-0884", "reason": "Used as adjective 'tancat'. Ambiguous with tancar [verb]." },
  { "surface": "riu", "correctLexemeId": "lx-0577", "reason": "Used as noun 'riu' (river). Ambiguous with riure [verb]." },
  { "surface": "vol", "correctLexemeId": "lx-1007", "reason": "Used as noun 'vol' (flight), but sometimes used as 'voler' (lx-0060)." },
  { "surface": "filla", "correctLexemeId": "lx-0903", "reason": "Used as noun 'filla' (daughter). Ambiguous with fill [noun]." },
  { "surface": "cuina", "correctLexemeId": "lx-0372", "reason": "Used as noun 'cuina' (kitchen). Ambiguous with cuinar [verb]." },
  { "surface": "pantalons", "correctLexemeId": "lx-0431", "reason": "Used as noun 'pantalons'. Ambiguous with pantaló." },
  { "surface": "rosa", "correctLexemeId": "lx-4620", "reason": "Used as noun/adjective 'rosa'. Ambiguous with ros." },
  { "surface": "sec", "correctLexemeId": "lx-4617", "reason": "Used as adjective 'sec'. Ambiguous with seure [verb]." },
  { "surface": "part", "correctLexemeId": "lx-0075", "reason": "Used as noun 'part'. Ambiguous with partir [verb]." },
  { "surface": "cosa", "correctLexemeId": "lx-0076", "reason": "Used as noun 'cosa'. Ambiguous with cos [noun]." },
  { "surface": "estat", "correctLexemeId": "lx-1257", "reason": "Used as noun 'estat'. Ambiguous with ser/estar [verb]." },
  { "surface": "mort", "correctLexemeId": "lx-4210", "reason": "Used as noun 'mort'. Ambiguous with morir [verb]." },
  { "surface": "cos", "correctLexemeId": "lx-0405", "reason": "Used as noun 'cos'. Ambiguous with cosir [verb]." },
  { "surface": "cursa", "correctLexemeId": "lx-3954", "reason": "Used as noun 'cursa'. Ambiguous with curs [noun]." },
  { "surface": "parella", "correctLexemeId": "lx-0912", "reason": "Used as noun 'parella'. Ambiguous with parell [noun]." }
];

// Wait, the binding is WRONG for 'veu' (it should be lx-0058), 'costa' (should be lx-0147), 'vol' in 'Ell vol...' (should be lx-0060), etc!
// If the text uses it as a verb but it's bound to the noun, homograph-review.json cannot just fix it; the seed-texts-ca.ts text needs to change its wording to avoid the wrong binding!
// Or I can add "reason" and "correctLexemeId": "lx-XXXX", and if correctLexemeId is not the one it's bound to, it's a defect?
// No, the homograph-review.json specifies the correctLexemeId for a given surface form. If the text uses the other one, it's a defect.
// The best way is to rewrite the texts to avoid using 'veu', 'costa', 'vol' as verbs if they are homographs, OR specify the correctLexemeId for them.
