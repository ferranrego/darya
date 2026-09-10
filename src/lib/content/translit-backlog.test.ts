import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { TRANSLIT_BACKLOG } from "../../../scripts/data/translit-backlog.ts";
import { isFlattenedTranslit } from "../lang/prs/translit-check.ts";
import { lexiconFileSchema } from "./schema.ts";

/**
 * The pronunciation backlog is allowed to shrink and nothing else.
 *
 * Darya has no audio, so the Latin line under each sentence is the whole of
 * a learner's pronunciation. 273 of 400 beginner sentences shipped without
 * one, invisibly - the reader guards on the field and draws a blank where the
 * pronunciation should be, so the app looked fine and simply taught nothing
 * about how any of it sounds. Worse, the gap was *growing*: 231 of 358 a few
 * commits earlier. Every authoring batch made it bigger because no check
 * existed to notice.
 *
 * `build-seed-texts.ts` now requires the field, and exempts only the texts
 * that predate the rule. This test is what stops the exemption becoming a
 * permanent hiding place: the ceiling below can be lowered as batches land,
 * and may never be raised. When it reaches zero, delete the backlog, this
 * test, and the exemption in the build.
 */
const CEILING = 37;

describe("transliteration backlog", () => {
  it("never grows", () => {
    expect(TRANSLIT_BACKLOG.size).toBeLessThanOrEqual(CEILING);
  });

  it("lists only texts that really are missing a transliteration", () => {
    // A slug that no longer needs the exemption is a slug quietly excusing a
    // future regression, so an over-broad backlog fails just like a growing
    // one. Reads the built corpus, which is what the app actually serves.
    const dir = join(process.cwd(), "content", "prs", "texts", "seed");
    const stillMissing = new Set<string>();
    for (const file of readdirSync(dir)) {
      const doc = JSON.parse(readFileSync(join(dir, file), "utf8"));
      const slug = file.replace(/^tx-seed-/, "").replace(/\.json$/, "");
      if (!doc.titleTranslit || doc.sentences.some((s: { translit?: string }) => !s.translit)) {
        stillMissing.add(slug);
      }
    }
    const stale = [...TRANSLIT_BACKLOG].filter((slug) => !stillMissing.has(slug));
    expect(stale).toEqual([]);
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
