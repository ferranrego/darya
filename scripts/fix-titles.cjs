const fs = require('fs');
const file = 'scripts/data/seed-texts-ca.ts';
let data = fs.readFileSync(file, 'utf8');
data = data.replace(/titleTarget: "",/g, 'titleTarget: "El text",');
data = data.replace(/titleEn: "",/g, 'titleEn: "The text",');
fs.writeFileSync(file, data);
console.log("Fixed titles");
