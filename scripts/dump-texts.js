
require('ts-node/register');
const ca = require('./scripts/data/seed-texts-ca.ts').seedTexts;
const prs = require('./scripts/data/seed-texts-prs.ts').seedTexts;

const fs = require('fs');

function dump(texts, lang) {
  let md = "# " + lang.toUpperCase() + " Texts\n\n";
  for (const t of texts) {
    if (t.level !== 'L1' && t.level !== 'L2') continue;
    md += "### " + t.slug + " (" + t.level + ")\n";
    for (const s of t.sentences) {
      md += "- " + s.en + "\n";
    }
    md += "\n";
  }
  return md;
}

fs.writeFileSync('narrative_audit.md', dump(ca, 'ca') + dump(prs, 'prs'));
console.log("Dumped to narrative_audit.md");
