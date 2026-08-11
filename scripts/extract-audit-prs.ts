import fs from 'fs';
import { seedTexts } from './data/seed-texts-prs.ts';

const extractSchedule = (file) => {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const seqs = {};
  for (const line of lines) {
    const match = line.match(/Seq(?: offset:)? (\d+) \| .*? \| Introduces: (.*)/);
    if (match) {
      const seq = parseInt(match[1], 10);
      const words = match[2].split(' | ').map(w => w.split(' (')[0].trim());
      seqs[seq] = words;
    }
  }
  return seqs;
};

const prsL1Schedule = extractSchedule('prs-l1-schedule-correct.txt');
const prsL2Schedule = extractSchedule('prs-l2-schedule-correct.txt');

let md = "# Dari L1 & L2 Texts Audit\n\n";

for (const t of seedTexts) {
  if (t.level !== 'L1' && t.level !== 'L2') continue;
  
  const schedule = t.level === 'L1' ? prsL1Schedule : prsL2Schedule;
  const words = schedule[t.seq] || [];
  
  md += `## ${t.slug} (Seq: ${t.seq})\n`;
  md += `**Target Words**: ${words.join(', ')}\n\n`;
  for (const s of t.sentences) {
    md += `- ${s.target} *(${s.en})*\n`;
  }
  md += "\n";
}

fs.writeFileSync('prs_audit.md', md);
console.log("Wrote prs_audit.md");
