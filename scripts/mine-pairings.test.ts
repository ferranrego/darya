import { describe, expect, it } from "vitest";

import type { LexiconEntry } from "../src/lib/content/schema.ts";
import { ca } from "../src/lib/lang/ca/index.ts";
import {
  annotateAmbiguous,
  findHomographIds,
  minePairings,
  type PairCount,
} from "./mine-pairings.ts";

/**
 * Runs the miner against the real Catalan tokenizer and production index
 * (`ca.text.tokenize` / `ca.text.buildIndex`) rather than a stand-in, per the
 * file header's non-negotiable: resolution must stay production-accurate or
 * the test would not exercise the trap it is meant to catch.
 */
function entry(id: string, target: string, pos: LexiconEntry["pos"], glossEn: string): LexiconEntry {
  return {
    id,
    target,
    targetNormalized: target,
    glossEn,
    pos,
    freqRank: Number(id.replace("lx-", "")),
    freqBand: 5,
    register: "neutral",
    variants: [],
    exampleTarget: target,
    exampleEn: glossEn,
    tags: [],
  };
}

const entries: LexiconEntry[] = [
  entry("lx-0001", "poma", "noun", "apple"),
  entry("lx-0002", "vermella", "adjective", "red"),
  entry("lx-0003", "pera", "noun", "pear"),
  entry("lx-0004", "verda", "adjective", "green"),
  // Homograph: both spelled "riu". The noun (river) is authored first, so
  // production `resolve()` always picks it - lx-0006 can never be reached by
  // any surface, which is exactly the trap: real evidence for one lexeme gets
  // credited to a different one with the same spelling.
  entry("lx-0005", "riu", "noun", "river"),
  entry("lx-0006", "riu", "verb", "(he/she) laughs - shadowed by lx-0005"),
  entry("lx-0007", "gelat", "adjective", "cold"),
];

const sentences = [
  // mod(poma, vermella): 3 occurrences - at the count threshold, must survive.
  "La poma vermella és bona.",
  "La poma vermella és bona.",
  "La poma vermella és bona.",
  // mod(poma, verda): 2 occurrences - below the count threshold, must be dropped.
  "La poma verda és petita.",
  "La poma verda és petita.",
  // "pera" never sits near an adjective within the window - must stay unattested.
  "Compro la pera.",
  // mod(riu, gelat) x3, via the homograph surface "riu".
  "El riu és gelat.",
  "El riu és gelat.",
  "El riu és gelat.",
];

function mine(): PairCount[] {
  const index = ca.text.buildIndex(entries);
  return minePairings(sentences, ca.text.tokenize, index);
}

describe("minePairings", () => {
  it("finds a pair attested at or above the count threshold", () => {
    const pairs = mine();
    const pomaVermella = pairs.find((p) => p.lexemeA === "lx-0001" && p.lexemeB === "lx-0002");
    expect(pomaVermella).toBeDefined();
    expect(pomaVermella?.kind).toBe("mod");
    expect(pomaVermella?.count).toBe(3);
  });

  it("leaves an unattested pair out of the results", () => {
    const pairs = mine();
    const touchesPera = pairs.some((p) => p.targetA === "pera" || p.targetB === "pera");
    expect(touchesPera).toBe(false);
  });

  it("drops a pair below the count threshold", () => {
    const pairs = mine();
    const pomaVerda = pairs.find((p) => p.lexemeA === "lx-0001" && p.lexemeB === "lx-0004");
    expect(pomaVerda).toBeUndefined();
  });

  it("credits a homograph's attestations to exactly one entry, and the report flags it", () => {
    const pairs = mine();

    // resolve() can only ever pick one of the two "riu" entries, and it is
    // always the same one (headword precedence) - never a mix, never lx-0006.
    const riuGelat = pairs.filter((p) => p.targetA === "riu" && p.targetB === "gelat");
    expect(riuGelat).toHaveLength(1);
    expect(riuGelat[0].lexemeA).toBe("lx-0005");
    expect(riuGelat[0].count).toBe(3);
    expect(pairs.some((p) => p.lexemeA === "lx-0006")).toBe(false);

    // The miner cannot know from resolve() alone that this is ambiguous - it
    // has to be told independently, from the lexicon itself.
    const homographIds = findHomographIds(entries);
    expect(homographIds.has("lx-0005")).toBe(true);
    expect(homographIds.has("lx-0006")).toBe(true);

    const annotated = annotateAmbiguous(pairs, homographIds);
    const annotatedRiuGelat = annotated.find((p) => p.targetA === "riu" && p.targetB === "gelat");
    expect(annotatedRiuGelat?.ambiguous).toBe(true);

    // A non-homograph pair must not be flagged.
    const annotatedPomaVermella = annotated.find((p) => p.targetA === "poma" && p.targetB === "vermella");
    expect(annotatedPomaVermella?.ambiguous).toBe(false);
  });
});
