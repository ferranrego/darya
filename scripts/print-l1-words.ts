import { levels, lexicon } from "../src/lib/content/load.ts";
const l1 = levels[0];
const inBand = lexicon.entries.filter((e) => l1.freqBands.includes(e.freqBand));
console.log(inBand.slice(0, 60).map(e => e.target).join(", "));
