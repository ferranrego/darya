const fs = require('fs');
const file = 'scripts/data/seed-texts-prs.ts';
let data = fs.readFileSync(file, 'utf8');

const replacements = [
  {
    from: '{ target: "سپس، قند را در آب می‌اندازد.", en: "Then, he throws sugar in the water." }',
    to: '{ target: "او قند را در آب می‌اندازد.", en: "He throws sugar in the water." }'
  },
  {
    from: '{ target: "چوب درخت می‌پوسد.", en: "The wood of the tree rots." }',
    to: '{ target: "این درخت می‌پوسد.", en: "This tree rots." }'
  },
  {
    from: '{ target: "او موی اسب را می‌تابد.", en: "He twists the horse\'s hair." }',
    to: '{ target: "او موی اسپ را می‌تابد.", en: "He twists the horse\'s hair." }'
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
