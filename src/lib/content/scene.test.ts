import { describe, expect, it } from "vitest";
import { profile } from "../lang/index.ts";
import { buildScene, defaultRecipes, scenesFor } from "./scene.ts";
import { fieldWords } from "./beginner-spec.ts";
import { isTeachable } from "./teachability.ts";
import { levelVocabulary } from "./level-vocabulary.ts";
import { lexicon, levels } from "./load.ts";
import { teachablePool } from "./word-selection.ts";

describe(`${profile.code} scenes`, () => {
  it("every default recipe reaches a usable scene at every level, including pre-A1", () => {
    // The whole point: the old cold-start slice gave pre-A1 eighteen nouns,
    // twelve of them concrete, and asked the model to write about words
    // outside that list entirely. A scene has to be buildable from the very
    // first level or nothing downstream is fixed.
    for (const level of levels) {
      const scenes = scenesFor(level, lexicon.entries, isTeachable);
      expect(
        scenes.length,
        `${level.id} (${level.cefrHint}): only ${scenes.length}/${defaultRecipes().length} recipes reached a scene`,
      ).toBe(defaultRecipes().length);
    }
  });

  it("sizes every scene inside the stated 25-45 word range", () => {
    const l1 = levels[0];
    for (const scene of scenesFor(l1, lexicon.entries, isTeachable)) {
      expect(scene.words.length).toBeGreaterThanOrEqual(25);
      expect(scene.words.length).toBeLessThanOrEqual(45);
    }
  });

  it("includes every reachable field word before any shared filler crowds it out", () => {
    // existence/possession/daily-routine verbs and size/age/colour
    // adjectives are attached to every recipe as filler for fields too thin
    // to reach the minimum alone (Food & Drink has 23 reachable words at L1,
    // just short of the 25 floor). Sorting the combined pool by raw frequency
    // let the filler - far more frequent than almost any field word - fill
    // the 45-word cap before the field's own vocabulary did, so every scene
    // opened with the same eight words regardless of topic. The fix ranks
    // each source separately and concatenates field-first: every field word
    // this level can actually reach must survive into the scene, and none of
    // them should be pushed out by a generic verb or adjective.
    const l1 = levels[0];
    const foodRecipe = defaultRecipes().find((r) => r.fields[0] === "Food & Drink")!;
    const scene = buildScene(foodRecipe, l1, lexicon.entries, isTeachable)!;
    expect(scene).not.toBeNull();

    const reachable = new Set(
      [
        ...levelVocabulary(l1, lexicon.entries, isTeachable),
        ...teachablePool(lexicon.entries, l1, () => false, isTeachable),
      ].map((e) => e.id),
    );
    const reachableFieldWords = fieldWords("Food & Drink").filter(
      (e) => isTeachable(e) && reachable.has(e.id),
    );
    expect(reachableFieldWords.length).toBeGreaterThan(0);

    const sceneIds = new Set(scene.words.map((e) => e.id));
    for (const word of reachableFieldWords) {
      expect(sceneIds.has(word.id), `${word.id} (${word.target}) is a reachable Food & Drink word missing from the scene`).toBe(true);
    }
  });

  it("returns null rather than a half-empty scene for an unreachable recipe", () => {
    const l1 = levels[0];
    const impossible = { id: "nowhere", fields: ["Nonexistent Field"] };
    expect(buildScene(impossible, l1, lexicon.entries, isTeachable)).toBeNull();
  });

  it("gives every scene word a lexeme the level's own gates would call reachable", () => {
    for (const level of levels) {
      for (const scene of scenesFor(level, lexicon.entries, isTeachable)) {
        for (const entry of scene.words) {
          expect(isTeachable(entry), `${scene.id}/${level.id}: ${entry.id} (${entry.target}) not teachable`).toBe(true);
        }
      }
    }
  });

  it("grows the same recipe's scene as the level rises", () => {
    // "A richer scene at A2 than at pre-A1" is the claim; the cap makes this
    // about which words are available to choose among, not raw count, so this
    // checks the field pool itself grows rather than the (capped) result.
    const recipe = defaultRecipes().find((r) => r.fields[0] === "Places & Buildings")!;
    const l1Words = new Set(buildScene(recipe, levels[0], lexicon.entries, isTeachable)!.words.map((e) => e.id));
    const upperLevel = levels.at(-1)!;
    const upperWords = new Set(buildScene(recipe, upperLevel, lexicon.entries, isTeachable)!.words.map((e) => e.id));
    for (const id of l1Words) {
      expect(upperWords.has(id), `${id} available at ${levels[0].id} but not at ${upperLevel.id}`).toBe(true);
    }
  });
});
