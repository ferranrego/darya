const fs = require('fs');

const extractTexts = (filePath, lang) => {
  const content = fs.readFileSync(filePath, 'utf8');
  // Since they are TS files, we can just require them using ts-node or just regex parse.
  // Actually, we can use the compiled output or just write a quick script that uses `build-seed-texts.ts`
  // Wait, `scripts/data/seed-texts-ca.ts` is exported as `seedTexts`.
};

// Let's create a temporary file that imports them and logs to JSON
const script = `
require('ts-node/register');
const ca = require('./scripts/data/seed-texts-ca.ts').seedTexts;
const prs = require('./scripts/data/seed-texts-prs.ts').seedTexts;

const fs = require('fs');

function dump(texts, lang) {
  let md = "# " + lang.toUpperCase() + " Texts\\n\\n";
  for (const t of texts) {
    if (t.level !== 'L1' && t.level !== 'L2') continue;
    md += "### " + t.slug + " (" + t.level + ")\\n";
    for (const s of t.sentences) {
      md += "- " + s.en + "\\n";
    }
    md += "\\n";
  }
  return md;
}

fs.writeFileSync('narrative_audit.md', dump(ca, 'ca') + dump(prs, 'prs'));
console.log("Dumped to narrative_audit.md");
`;

fs.writeFileSync('scripts/dump-texts.js', script);
