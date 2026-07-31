import fs from 'fs';
const data = JSON.parse(fs.readFileSync('content/ca/lexicon/lexicon.json', 'utf8'));

let tontoFound = false;
data.entries = data.entries.map(w => {
  if (w.id === 'lx-0944' && w.target === 'tonto') {
    w.target = 'ximple';
    if(w.targetNormalized) w.targetNormalized = 'ximple';
    w.exampleTarget = 'És una mica ximple.';
    tontoFound = true;
  }
  return w;
});

if (tontoFound) {
  fs.writeFileSync('content/ca/lexicon/lexicon.json', JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log('Fixed tonto -> ximple');
} else {
  console.log('tonto not found');
}
