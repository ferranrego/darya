import { describe, expect, it } from "vitest";

import { levels } from "../content/load.ts";
import { isBeginnerLevel } from "../content/word-selection.ts";
import { profile } from "../lang/index.ts";
import type { LexiconEntry } from "../content/schema.ts";
import { buildPrompt } from "./generate.ts";

/**
 * What the generator actually asks for, checked without calling a provider.
 *
 * The app's AI quota belongs to its learners, so prompt changes are verified by
 * reading the prompt rather than by generating from it. That turns out to be
 * the better test anyway: a live run tells you what one model did once, while
 * this tells you what every model is being asked for, at every level, in both
 * languages, in under a second.
 *
 * The failure being guarded is real and shipped. Every level was asked for "a
 * short story with a beginning and an end" where "every sentence follows from
 * the one before it" - at pre-A1, inside two or three sentences of at most six
 * words with no conjunctions. That is not writable, and it produced
 * "Soc l'home / No estic / Seré el que serà" titled "Work Instructions".
 */

const word = (over: Partial<LexiconEntry>): LexiconEntry =>
  ({
    id: "lx-0001",
    target: "x",
    targetNormalized: "x",
    glossEn: "x",
    pos: "noun",
    freqRank: 1,
    freqBand: 1,
    register: "neutral",
    variants: [],
    exampleTarget: "x",
    exampleEn: "x",
    tags: [],
    ...over,
  }) as LexiconEntry;

function promptFor(levelIndex: number): string {
  return buildPrompt({
    level: levels[levelIndex],
    knownWords: [word({ target: "casa" })],
    knownIds: new Set(["lx-0001"]),
    targetWords: [word({ id: "lx-0002", target: "gos" })],
    newWordRatio: 0.05,
  });
}

describe(`${profile.code} prompt shape`, () => {
  it.each(levels.map((l, i) => [l.id, l.cefrHint, i] as const))(
    "%s (%s) asks for the right kind of text",
    (_id, _hint, i) => {
      const level = levels[i];
      const prompt = promptFor(i);

      if (isBeginnerLevel(level)) {
        // A scene, not a story. A narrative needs anaphora to track who is
        // being talked about and a way to sequence events, and neither is
        // taught at pre-A1 - so asking for one produced filler. See the note on
        // `taskFor`.
        expect(prompt, "beginner levels get a scene").toContain("STRICT SCENE RULES");
        expect(prompt).toContain("coherent scene");
        // The prompt does mention a story - to forbid one - so this checks the
        // instruction, not the noun: the `Write <TEXT_TYPE>, <n>-<m> sentences`
        // form belongs to the non-beginner branch and must not appear here.
        expect(
          prompt,
          "a beginner text must not be asked for a plot it has no machinery for",
        ).not.toMatch(/^Write (.+?), \d/m);
        // Meeting a word once does not teach it.
        expect(prompt).toContain("Meeting a word twice is what teaches it");
      } else {
        expect(prompt, "an A2+ text should hold together").toContain(
          "follows from the one before it",
        );
        expect(
          prompt,
          "the beginner scene scaffold should not persist upward",
        ).not.toContain("STRICT SCENE RULES");
      }
    },
  );

  /**
   * The prompt used to argue with the level it was built from.
   *
   * `taskFor` told the model to "use natural beginner conjunctions" while the
   * `sentenceLengthHint` it interpolated two lines earlier said `NO conjunctions
   * (no 'and', 'but')`. Both went to the model in the same request. The rule now
   * lives in the level, in that language's own words, and the task defers to it.
   */
  it.each(levels.filter(isBeginnerLevel).map((l) => [l.id, levels.indexOf(l)] as const))(
    "%s does not contradict its own level about conjunctions",
    (_id, i) => {
      const prompt = promptFor(i);
      expect(prompt).toContain(levels[i].sentenceLengthHint);
      expect(prompt).not.toContain("Use natural beginner conjunctions");
    },
  );

  it.each(levels.map((l, i) => [l.id, i] as const))("%s carries the shared rules", (_id, i) => {
    const prompt = promptFor(i);
    // Named substitutions for the interference each language is prone to. A
    // model writing Catalan reaches for Spanish and one writing Dari reaches
    // for Iranian Persian, and the result is fluent and wrong.
    expect(prompt).toContain(profile.prompts.interference.split("\n")[0]);
    expect(prompt).toContain(profile.prompts.orthography.split("\n")[0]);
    // "Use only these 250 words" is not followable without this licence.
    expect(prompt).toContain("Articles, prepositions, pronouns");
    expect(prompt).toContain("JSON");
    // The words it exists to teach, and the level's own grammar.
    expect(prompt).toContain("gos");
    expect(prompt).toContain(levels[i].grammarAllowed[0]);
  });

  it("names no language, since one file serves both builds", () => {
    // prompt-leak.test.ts greps the source; this checks the rendered result,
    // which is where an interpolated profile string could still leak one.
    const foreign = profile.code === "ca" ? /\bDari\b|\bPersian\b/i : /\bCatalan\b/i;
    for (let i = 0; i < levels.length; i++) {
      expect(promptFor(i)).not.toMatch(foreign);
    }
  });

  it("varies the task across attempts at levels that have several forms", () => {
    const upper = levels.findIndex((l) => !isBeginnerLevel(l));
    if (upper === -1) return;
    const seen = new Set<string>();
    for (let attempt = 0; attempt < 12; attempt++) {
      const m = buildPrompt(
        {
          level: levels[upper],
          knownWords: [word({})],
          knownIds: new Set(["lx-0001"]),
          targetWords: [word({ id: "lx-0002", target: "gos" })],
          newWordRatio: 0.05,
        },
        attempt,
      ).match(/^Write (.+?), \d/m);
      if (m) seen.add(m[1]);
    }
    // A retry that asks the identical question is a wasted call.
    expect(seen.size, "the text type never varied").toBeGreaterThan(1);
  });
});
