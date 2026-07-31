import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { ca } from "../src/lib/lang/ca/index.ts";
import { matchKey } from "../src/lib/lang/ca/normalize.ts";
import { verifyEntry, type CandidateEntry } from "./verify-ca-entries.ts";

const root = join(import.meta.dirname, "..");
const lexPath = join(root, "content", "ca", "lexicon", "lexicon.json");
const tempDir = join(root, "temp", "lexicon_domains");

const file = JSON.parse(readFileSync(lexPath, "utf8"));
const existing: { target: string; freqRank: number }[] = file.entries;
const seenKeys = new Map<string, string>(
  existing.map((e) => [matchKey(e.target), e.target] as const),
);
let nextRank = Math.max(...existing.map((e) => e.freqRank)) + 1;

const accepted: Record<string, unknown>[] = [];
const rejected: string[] = [];

if (existsSync(tempDir)) {
  const files = readdirSync(tempDir).filter(f => f.match(/^(b5|b6|b8)_.*\.json$/));
  for (const f of files) {
    const data = JSON.parse(readFileSync(join(tempDir, f), "utf8"));
    const entries = Array.isArray(data) ? data : data.entries || [];
    
    let kept = 0;
    for (const c of entries) {
      const candidate: CandidateEntry = {
        word: ca.text.normalize(c.word || c.target || ""),
        pos: (c.pos || "").trim(),
        gloss: (c.gloss || c.glossEn || "").trim(),
        example: ca.text.normalize(c.example || c.exampleTarget || ""),
        exampleEn: (c.exampleEn || "").trim(),
      };
      
      const key = matchKey(candidate.word);
      if (seenKeys.has(key)) {
         rejected.push(`${candidate.word}: duplicate`);
         continue;
      }

      const problems = verifyEntry(candidate, seenKeys);
      if (problems.length) {
        rejected.push(`${candidate.word || "?"}: ${problems[0]}`);
        continue;
      }
      
      seenKeys.set(key, candidate.word);
      
      let band = 5;
      let tag = "B1 Intermediate";
      if (f.startsWith("b6_")) {
        band = 6;
        tag = "B1+ Intermediate High";
      } else if (f.startsWith("b8_")) {
        band = 8;
        tag = "B2+ Advanced High";
      }

      accepted.push({
        id: `lx-${String(nextRank).padStart(4, "0")}`,
        target: candidate.word,
        targetNormalized: candidate.word,
        glossTarget: candidate.gloss,
        glossEn: candidate.gloss,
        pos: candidate.pos,
        freqRank: nextRank,
        freqBand: band,
        register: "neutral",
        variants: [],
        exampleTarget: candidate.example,
        exampleEn: candidate.exampleEn,
        tags: [tag],
      });
      nextRank++;
      kept++;
    }
    console.log(`${f.padEnd(30)} ${kept}/${entries.length} kept`);
  }
}

console.log(`\naccepted ${accepted.length}, rejected ${rejected.length}`);
for (const r of rejected.slice(0, 15)) console.log(`  ✗ ${r}`);
if (rejected.length > 15) console.log(`  … and ${rejected.length - 15} more`);

if (accepted.length) {
  file.entries = [...existing, ...accepted];
  writeFileSync(lexPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nWrote ${lexPath} (${file.entries.length} entries)`);
}
