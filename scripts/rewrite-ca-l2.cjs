const fs = require('fs');
const file = 'scripts/data/seed-texts-ca.ts';
let data = fs.readFileSync(file, 'utf8');

const replacements = [
  // l2-056 mostra -> mostren
  {
    from: '{ target: "El militar superior ataca i mostra la fi del camí.", en: "The superior military attacks and shows the end of the path." }',
    to: '{ target: "Els militars superiors ataquen i mostren la fi del camí.", en: "The superior militaries attack and show the end of the path." }'
  }
];

let changed = 0;
for (const r of replacements) {
  if (data.includes(r.from)) {
    data = data.replace(r.from, r.to);
    changed++;
  } else {
    console.log("NOT FOUND:", r.from);
  }
}

fs.writeFileSync(file, data);
console.log(`Replaced ${changed} strings.`);
