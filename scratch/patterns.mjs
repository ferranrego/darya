import { readFileSync } from "node:fs";
import { IRREGULAR_VERBS } from "../src/lib/lang/ca/irregulars.ts";
const lx = JSON.parse(readFileSync("content/ca/lexicon/lexicon.json","utf8")).entries;
const verbs = lx.filter(e => e.pos === "verb").map(e => e.target);
const covered = new Set(Object.keys(IRREGULAR_VERBS));

// Catalan patterns that are NEVER regular: they take a velar stem in the
// subjunctive/1sg (venc/vengui) which no rule derives from the infinitive.
const PATTERNS = {
  "-ndre (velar: venc, vengui)": /ndre$/,
  "-èixer/-eixer (conec, conegui)": /[èe]ixer$/,
  "-ure (visc, bec, moc)": /ure$/,
  "-oldre/-aldre (resolc, calc)": /[oa]ldre$/,
  "-ler (vull, valc)": /ler$/,
};
for (const [name, re] of Object.entries(PATTERNS)) {
  const hits = verbs.filter(v => re.test(v));
  const gaps = hits.filter(v => !covered.has(v));
  console.log(`${name}`);
  console.log(`   in lexicon: ${hits.length}   missing a paradigm: ${gaps.length}${gaps.length ? "  -> " + gaps.join(", ") : ""}`);
}
