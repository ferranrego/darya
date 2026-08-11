const fs = require('fs');
const file = 'scripts/data/seed-texts-prs.ts';
let data = fs.readFileSync(file, 'utf8');
data = data.replace(/titleTarget: "",/g, 'titleTarget: "متن",');
data = data.replace(/titleEn: "",/g, 'titleEn: "The text",');
fs.writeFileSync(file, data);
console.log("Fixed titles in PRS");
