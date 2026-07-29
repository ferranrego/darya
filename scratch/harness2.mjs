import { verifyEntry } from "../scripts/verify-ca-entries.ts";
const seen = new Map([["ajudar", "ajudar"]]);
const cases = [
  { word: "ajudar", pos: "verb", gloss: "to help", example: "Ajudo la meva mare.", exampleEn: "x" },
  { word: "casada", pos: "adjective", gloss: "married", example: "La meva cosina és casada.", exampleEn: "x" },
  { word: "casat", pos: "adjective", gloss: "married", example: "El meu cosí és casat.", exampleEn: "x" },
];
for (const c of cases) console.log(`  ${c.word.padEnd(9)} -> ${verifyEntry(c, seen).join("; ") || "ACCEPTED"}`);
