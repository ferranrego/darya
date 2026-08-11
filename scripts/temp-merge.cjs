const fs = require('fs');

const lang = process.argv[2];
const batchFile = process.argv[3];
const destFile = `scripts/data/seed-texts-${lang}.ts`;

const level = process.argv[4] || "L1";

const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
let source = fs.readFileSync(destFile, 'utf8');

let newObjects = "";
for (const item of batch) {
  const targetLines = item[lang].replace(/\\\\n/g, '\\n').split('\\n').filter(Boolean);
  const enLines = item.en.replace(/\\\\n/g, '\\n').split('\\n').filter(Boolean);
  
  let sentences = "";
  for (let i = 0; i < targetLines.length; i++) {
    sentences += `      { target: ${JSON.stringify(targetLines[i])}, en: ${JSON.stringify(enLines[i] || "")} },\n`;
  }

  newObjects += `  {
    slug: "${item.slug}",
    level: "${level}",
    seq: parseInt("${item.slug}".split('-')[1], 10),
    titleTarget: "",
    titleEn: "",
    sentences: [
${sentences}    ],
  },\n`;
}

source = source.replace(/];\s*$/, ",\n" + newObjects + "];\n");
fs.writeFileSync(destFile, source);
console.log(`Merged ${batch.length} texts into ${destFile}`);
