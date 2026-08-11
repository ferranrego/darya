const fs = require('fs');
const file = 'scripts/data/seed-texts-prs.ts';
let data = fs.readFileSync(file, 'utf8');

const replacements = [
  {
    from: '{ target: "کلید کجاست؟", en: "Where is the key?" }',
    to: '{ target: "کلید کجا است؟", en: "Where is the key?" }'
  },
  {
    from: '{ target: "شک شما بیجا است.", en: "Your doubt is out of place." }',
    to: '{ target: "شک شما بزرگ است.", en: "Your doubt is big." }'
  },
  {
    from: '{ target: "افغانی چوب می‌سوزاند.", en: "The Afghan burns wood." }',
    to: '{ target: "افغانی کاغذ می‌سوزاند.", en: "The Afghan burns paper." }'
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
