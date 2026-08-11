const fs = require('fs');

const extractSchedule = (file) => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const seqs = {};
  for (const line of lines) {
    const match = line.match(/Seq (?:offset: )?(\d+) \| .*? \| Introduces: (.*)/);
    if (match) {
      const seq = parseInt(match[1], 10);
      const words = match[2].split(' | ').map(w => w.split(' (')[0].trim());
      seqs[seq] = words;
    }
  }
  return seqs;
};

const caL1Schedule = extractSchedule('ca-l1-schedule-correct.txt');
const caL2Schedule = extractSchedule('ca-l2-schedule-correct.txt');

// We have to mock or extract from seed-texts-ca.ts
// I'll parse it using simple regex or evaluating.
const { seedTexts } = require('./scripts/data/seed-texts-ca.ts');

let md = "# Catalan L1 & L2 Texts Audit\n\n";

for (const t of seedTexts) {
  if (t.level !== 'L1' && t.level !== 'L2') continue;
  
  const schedule = t.level === 'L1' ? caL1Schedule : caL2Schedule;
  const words = schedule[t.seq] || [];
  
  md += `## ${t.slug} (Seq: ${t.seq})\n`;
  md += `**Target Words**: ${words.join(', ')}\n\n`;
  for (const s of t.sentences) {
    md += `- ${s.target} *(${s.en})*\n`;
  }
  md += "\n";
}

fs.writeFileSync('ca_audit.md', md);
console.log("Wrote ca_audit.md");
