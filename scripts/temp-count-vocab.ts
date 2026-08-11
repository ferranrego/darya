import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const langs = ["ca", "prs"];
const levels = ["L1", "L2"];
const levelTargets: Record<string, number> = { L1: 500, L2: 700 };

console.log("| Language | Level | Texts Count | Unique Words Taught | % of Level Target |");
console.log("|---|---|---|---|---|");

for (const lang of langs) {
  const seedDir = join("content", lang, "texts", "seed");
  const files = readdirSync(seedDir).filter(f => f.endsWith(".json"));
  
  for (const level of levels) {
    const levelFiles = files.filter(f => f.includes(`-seed-${level.toLowerCase()}-`));
    const uniqueWords = new Set<string>();
    
    for (const file of levelFiles) {
      const data = JSON.parse(readFileSync(join(seedDir, file), "utf8"));
      if (data.newWords) {
        for (const word of data.newWords) {
          uniqueWords.add(word);
        }
      } else if (data.vocabUsed) { // fallback
        for (const word of data.vocabUsed) {
          uniqueWords.add(word);
        }
      }
    }
    
    const count = uniqueWords.size;
    const target = levelTargets[level];
    const pct = ((count / target) * 100).toFixed(1);
    
    console.log(`| ${lang === "ca" ? "Catalan" : "Dari"} | ${level} | ${levelFiles.length} | ${count} | ${pct}% |`);
  }
}
