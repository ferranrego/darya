import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { isFlattenedTranslit } from "../lang/prs/translit-check.ts";
import { lexiconFileSchema } from "./schema.ts";

/**
 * Every beginner sentence has a pronunciation, and must keep one.
 *
 * Darya has no audio, so the Latin line under each sentence is the whole of a
 * learner's pronunciation - and onboarding asks new learners whether they can
 * read the script, so the people worst affected by its absence are exactly the
 * ones who answered "not yet". 273 of 400 sentences shipped without one. The
 * reader guards on the field and draws blank space, so nothing looked broken.
 *
 * Worse, the gap was *growing*: 231 of 358 a few commits before it was
 * measured, because every authoring batch added sentences and no check was
 * watching. `build-seed-texts.ts` now requires the field outright; the backlog
 * that carried the unwritten texts is deleted, along with its exemption.
 */
describe("beginner pronunciation", () => {
  it("is present on every sentence and every title", () => {
    const dir = join(process.cwd(), "content", "prs", "texts", "seed");
    const missing: string[] = [];
    for (const file of readdirSync(dir)) {
      const doc = JSON.parse(readFileSync(join(dir, file), "utf8"));
      if (!doc.titleTranslit) missing.push(`${file}: title`);
      doc.sentences.forEach((s: { target: string; translit?: string }, i: number) => {
        if (!s.translit) missing.push(`${file}: sentence ${i + 1}`);
      });
    }
    expect(missing).toEqual([]);
  });
});

/**
 * The runtime half of the same rule.
 *
 * `load.ts` hides an example sentence's transliteration when it was written
 * in Iranian Persian, so a learner is shown nothing rather than something
 * wrong. This asserts the hiding actually happens - the backlog above only
 * proves the *validator* knows about the defect, which is no comfort to
 * someone tapping a word in the reader.
 */
describe("flattened transliterations never reach a learner", () => {
  it("is stripped from every entry the app loads", async () => {
    const { lexicon } = await import("./load.ts");
    const leaked = lexicon.entries
      .filter((e) => isFlattenedTranslit(e.exampleTranslit, e.exampleTarget, e.id))
      .map((e) => e.id);
    expect(leaked).toEqual([]);
  });

  it("leaves nothing for the rule to hide, now that all 1,214 are repaired", () => {
    // The backlog file and its exemption are gone; this is what replaces them.
    // If a future entry is written the Iranian way, this fails rather than the
    // app quietly blanking the line for learners.
    const file = join(process.cwd(), "content", "prs", "lexicon", "lexicon.json");
    const raw = lexiconFileSchema.parse(JSON.parse(readFileSync(file, "utf8")));
    const flagged = raw.entries
      .filter(
        (e) =>
          isFlattenedTranslit(e.exampleTranslit, e.exampleTarget, e.id) ||
          isFlattenedTranslit(e.translit, e.target, e.id),
      )
      .map((e) => e.id);
    expect(flagged).toEqual([]);
  });
});
