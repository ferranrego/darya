import fs from "fs";
import { join } from "path";
import { describe, it } from "vitest";
import { scheduleFor } from "../src/lib/content/schedule";
import { contentRoot } from "../scripts/content-path";

describe("Extract Remaining Schedule", () => {
  it("extracts next slots", () => {
    const lang = process.env.NEXT_PUBLIC_TARGET_LANG || "ca";
    
    const lexiconRaw = JSON.parse(fs.readFileSync(join(contentRoot(), "lexicon", "lexicon.json"), "utf8"));
    const entries = lexiconRaw.entries || Object.values(lexiconRaw); // Depending on schema
    const levelsRaw = JSON.parse(fs.readFileSync(join(contentRoot(), "levels", "levels.json"), "utf8"));
    const l1 = levelsRaw.levels.find((l: any) => l.id === "L1")!;
    const l2 = levelsRaw.levels.find((l: any) => l.id === "L2")!;

    const entryMap = new Map();
    for (const e of entries) {
      entryMap.set(e.id, e);
    }

    // Get currently used words in texts
    const usedL1 = new Set<string>();
    const usedL2 = new Set<string>();
    const seedDir = join(contentRoot(), "texts", "seed");
    if (fs.existsSync(seedDir)) {
      const dirFiles = fs.readdirSync(seedDir);
      for (const f of dirFiles) {
        if (!f.endsWith(".json")) continue;
        const data = JSON.parse(fs.readFileSync(join(seedDir, f), "utf8"));
        if (f.includes(`-seed-l1-`) && data.newWords) {
          for (const w of data.newWords) usedL1.add(w);
        }
        if (f.includes(`-seed-l2-`) && data.newWords) {
          for (const w of data.newWords) usedL2.add(w);
        }
      }
    }

    const isUsableL1 = (e: any) => !usedL1.has(e.id);
    const scheduleL1 = scheduleFor(l1, null, entries, isUsableL1);

    const isUsableL2 = (e: any) => !usedL1.has(e.id) && !usedL2.has(e.id);
    const scheduleL2 = scheduleFor(l2, l1, entries, isUsableL2);

    let outL1 = `=== ${lang} L1 Schedule ===\n`;
    const sourceContent = fs.readFileSync(join("scripts", "data", `seed-texts-${lang}.ts`), "utf8");
    const l1Matches = [...sourceContent.matchAll(/slug: "l1-(\d+)"/g)].map(m => parseInt(m[1]));
    const l1Max = l1Matches.length > 0 ? Math.max(...l1Matches) : 0;
    const l2Matches = [...sourceContent.matchAll(/slug: "l2-(\d+)"/g)].map(m => parseInt(m[1]));
    const l2Max = l2Matches.length > 0 ? Math.max(...l2Matches) : 0;

    for (let i = 0; i < 26; i++) { // Target ~26 more for L1
      if (i >= scheduleL1.length) break;
      const slot = scheduleL1[i];
      const words = slot.introduces.map((id: string) => {
        const entry = entryMap.get(id);
        const target = entry[lang]?.target || entry.target;
        return `${target} (${entry.glossEn})`;
      });
      outL1 += `Seq: ${l1Max + 1 + i} | Introduces: ${words.join(" | ")}\n`;
    }
    
    let outL2 = `\n=== ${lang} L2 Schedule ===\n`;
    for (let i = 0; i < 40; i++) { // Target ~40 more for L2
      if (i >= scheduleL2.length) break;
      const slot = scheduleL2[i];
      const words = slot.introduces.map((id: string) => {
        const entry = entryMap.get(id);
        const target = entry[lang]?.target || entry.target;
        return `${target} (${entry.glossEn})`;
      });
      outL2 += `Seq: ${l2Max + 1 + i} | Introduces: ${words.join(" | ")}\n`;
    }

    fs.writeFileSync(`temp-schedule-${lang}.txt`, outL1 + outL2);
  });
});
