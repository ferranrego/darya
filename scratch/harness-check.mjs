import { verifyEntry, verifyIrregulars } from "../scripts/verify-ca-entries.ts";
const seen = new Map();
const bad = [
  { word: "niño", pos: "noun", gloss: "child", example: "El niño juga.", exampleEn: "The child plays." },
  { word: "parlarse", pos: "verb", gloss: "to speak", example: "Jo parlarse molt.", exampleEn: "x" },
  { word: "casa", pos: "noun", gloss: "house", example: "El gos dorm.", exampleEn: "The dog sleeps." },
  { word: "menjar", pos: "verb", gloss: "to eat", example: "Menjo pa amb formatge.", exampleEn: "I eat bread with cheese." },
];
for (const c of bad) {
  const p = verifyEntry(c, seen);
  console.log(`${c.word.padEnd(10)} -> ${p.length ? "REJECTED: " + p.join("; ") : "ACCEPTED"}`);
}
console.log("\nirregular table problems:", verifyIrregulars().length || "none");
