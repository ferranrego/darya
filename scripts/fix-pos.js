import fs from "fs";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const validPos = new Set([
  "noun", "verb", "adjective", "adverb", "pronoun", 
  "preposition", "conjunction", "particle", "numeral", 
  "interjection", "determiner", "phrase"
]);

const filePath = process.argv[2] || "scripts/data/core-lexicon-6.txt";
const content = fs.readFileSync(filePath, "utf8");
const lines = content.split("\n");
for (let i = 0; i < lines.length; i++) {
  if (!lines[i].trim() || lines[i].startsWith("#")) continue;
  const parts = lines[i].split("|");
  if (parts.length < 11) continue;
  
  let pos = parts[3].toLowerCase().trim();
  // fix common mistakes
  if (pos.includes("noun")) pos = "noun";
  else if (pos.includes("verb")) pos = "verb";
  else if (pos.includes("adjective") || pos === "adj") pos = "adjective";
  else if (pos.includes("adverb") || pos === "adv") pos = "adverb";
  else if (pos.includes("pronoun")) pos = "pronoun";
  else if (pos.includes("preposition") || pos === "prep") pos = "preposition";
  else if (pos.includes("conjunction") || pos === "conj") pos = "conjunction";
  else if (pos.includes("interjection") || pos === "interj") pos = "interjection";
  else if (pos.includes("phrase") || pos === "expression") pos = "phrase";
  else if (pos.includes("particle")) pos = "particle";
  else if (pos.includes("numeral") || pos === "number") pos = "numeral";
  else if (pos.includes("determiner")) pos = "determiner";
  else pos = "noun"; // fallback
  
  parts[3] = pos;
  
  let reg = parts[4].toLowerCase().trim();
  if (reg.includes("neutral")) reg = "neutral";
  else if (reg.includes("spoken") || reg.includes("informal")) reg = "spoken";
  else if (reg.includes("formal")) reg = "formal";
  else if (reg.includes("literary")) reg = "literary";
  else reg = "neutral"; // fallback
  
  parts[4] = reg;
  
  lines[i] = parts.join("|");
}

fs.writeFileSync(filePath, lines.join("\n"));
console.log(`Fixed POS tags in ${filePath}`);
