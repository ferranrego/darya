const fs = require('fs');

const file = 'scripts/data/seed-texts-prs.ts';
let data = fs.readFileSync(file, 'utf8');

const regex = /(slug:\s*"l2-024"[\s\S]*?sentences:\s*\[)([\s\S]*?)(\]\s*,)/m;
const match = data.match(regex);

if (match) {
  const newSentences = `
      { target: "کارمند در شرق جنگل کار می‌کند.", en: "The employee works in the east of the forest." },
      { target: "او به متر نیاز دارد.", en: "He needs a tape measure." },
      { target: "او می‌بیند که این درخت می‌پوسد.", en: "He sees that this tree rots." }
    `;
  data = data.replace(regex, `$1${newSentences}$3`);
  fs.writeFileSync(file, data);
  console.log("Replaced l2-024");
} else {
  console.log("Could not find l2-024");
}
