import { readFileSync } from "node:fs";
import { IRREGULAR_VERBS } from "../src/lib/lang/ca/irregulars.ts";
const lx = JSON.parse(readFileSync("content/ca/lexicon/lexicon.json","utf8")).entries;
const verbs = lx.filter(e => e.pos === "verb").map(e => e.target);
const covered = new Set(Object.keys(IRREGULAR_VERBS));
// Verbs the engine will conjugate REGULARLY but that are actually irregular.
const KNOWN_IRREGULAR = ["ser","estar","haver","anar","fer","dir","poder","voler","saber","tenir","venir","veure","prendre","aprendre","comprendre","entendre","respondre","viure","beure","creure","escriure","conèixer","obrir","morir","córrer","dur","sortir","seure","treure","moure","caldre","valer","néixer","riure","dependre","perdre","vendre","rebre","pertànyer","merèixer","aparèixer","desaparèixer","parèixer","doldre","resoldre","encendre","estendre","ofendre","suspendre","atendre","pretendre","despendre","tondre","fondre","confondre"];
const missing = KNOWN_IRREGULAR.filter(v => verbs.includes(v) && !covered.has(v));
console.log("irregulares ya cubiertos:", covered.size);
console.log("en el léxico pero SIN tabla irregular:", missing.length);
console.log(" ", missing.join(", "));
