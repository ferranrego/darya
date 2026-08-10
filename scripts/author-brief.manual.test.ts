/**
 * Print everything a human (or an agent) needs to hand-write a batch of
 * curriculum texts for unauthored `schedule.ts` slots: the scene, the words
 * to introduce with correctly-inflected example forms, semantic notes, words
 * to reuse, and attested natural combinations. No model call anywhere in
 * this file - CLAUDE.md is explicit that the app's own provider chain is for
 * a live learner's own request, never for development or content authoring.
 * `scripts/data/seed-texts-<lang>.ts`'s own header says the same thing:
 * content is authored, not generated, unless told otherwise.
 *
 * This used to be `author-texts.live.test.ts`, which drafted candidates
 * against the live chain and scored the best one - built, run, and retired
 * the same session, after it (and an unrelated command run alongside it)
 * exhausted a full day of the shared Groq/OpenRouter/HuggingFace budget for
 * every learner using the deployment. What's kept here is everything that
 * was never the problem: the schedule, the inflection hints, the semantic
 * notes, the pairings. What's gone is the part that called a model.
 *
 * A `.manual.test.ts` file, not a plain `node scripts/…` script, for the
 * same reason the pipeline it replaces was: `scheduleFor` (and
 * `scene.ts`/`beginner-spec.ts` beneath it) resolve `@content/*`, which only
 * exists inside webpack (Next) and vitest's config, not plain `node`. See
 * `vitest.config.ts` - `*.manual.test.ts` is always excluded from `pnpm
 * test`, `LIVE_AI` or not, since this costs nothing but still isn't a
 * behavioural test to run automatically.
 *
 * Usage:
 *   MANUAL=1 NEXT_PUBLIC_TARGET_LANG=ca AUTHOR_LEVEL=L2 AUTHOR_FROM=8 AUTHOR_COUNT=5 \
 *     pnpm exec vitest run scripts/author-brief.manual.test.ts --disable-console-intercept
 *
 * (File path before the flag - vitest doesn't recognize
 * `--disable-console-intercept` and swallows the next token as its value
 * when the flag comes first, silently running the whole suite instead of
 * just this file. See CLAUDE.md's Verification section.)
 *
 * `AUTHOR_FROM` is 1-indexed into `scheduleFor`'s own `slot.seq` for the
 * level - pass the seq one past whatever is already landed in
 * `seed-texts-<lang>.ts`, so the brief continues the real curriculum.
 *
 * After hand-writing the texts from this brief into a staged JSON file
 * (`SeedTextSource[]`, matching `scripts/data/seed-texts-<lang>.ts`'s own
 * shape), check them with the same mechanical gates a drafting pipeline
 * would have scored against, and then a philologist review, before merging:
 *   node scripts/review-batch.ts --lang ca --texts <staged-file>
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lexicon, levels } from "../src/lib/content/load.ts";
import { profile } from "../src/lib/lang/index.ts";
import { scheduleFor, type Slot } from "../src/lib/content/schedule.ts";
import { closedClassOf } from "../src/lib/content/beginner-spec.ts";
import { levelVocabulary } from "../src/lib/content/level-vocabulary.ts";
import { isTeachable } from "../src/lib/content/teachability.ts";
import { isAnimate, isEdible, isHuman, isPlace } from "../src/lib/content/noun-features.ts";
import type { LexiconEntry, Level } from "../src/lib/content/schema.ts";

// ---------------------------------------------------------------------------
// Per-word inflection hints (surface.ts) - unchanged from the retired pipeline
// ---------------------------------------------------------------------------

async function inflectionHint(entry: LexiconEntry): Promise<string | null> {
  if (profile.code === "ca") {
    const surface = await import("../src/lib/lang/ca/surface.ts");
    try {
      if (entry.pos === "adjective") {
        const fem = surface.feminineOf(entry.target);
        return fem === entry.target ? null : `${entry.target} (m) / ${fem} (f)`;
      }
      if (entry.pos === "verb") {
        return `${entry.target} -> ${surface.presentOf(entry.target, "3sg")} (he/she ___s)`;
      }
      if (entry.pos === "noun") {
        return `${entry.target} -> ${surface.pluralOf(entry.target)} (plural)`;
      }
    } catch {
      return null;
    }
  } else if (profile.code === "prs") {
    const surface = await import("../src/lib/lang/prs/surface.ts");
    try {
      if (entry.pos === "verb" && entry.target === "داشتن") {
        const form = surface.presentOfDashtan("3sg");
        return `${entry.target} -> ${form.target} (${form.translit})`;
      }
      if (entry.pos === "verb") {
        const form = surface.presentIndicative(entry.target, "3sg");
        return `${entry.target} -> ${form.target} (${form.translit})`;
      }
      if (entry.pos === "noun" && entry.translit) {
        const form = surface.pluralOf(entry.target, entry.translit);
        return `${entry.target} -> ${form.target} (${form.translit}, plural)`;
      }
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Attested pairings (Step 3's TSV) - unchanged
// ---------------------------------------------------------------------------

interface Pairing {
  kind: "mod" | "vobj";
  idA: string;
  targetA: string;
  idB: string;
  targetB: string;
  count: number;
}

function loadPairings(): Pairing[] {
  const path = `scripts/data/pairings-${profile.code}.tsv`;
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return [];
  }
  const lines = raw.trim().split("\n").slice(1);
  return lines.map((line) => {
    const [kind, idA, targetA, idB, targetB, count] = line.split("\t");
    return { kind: kind as "mod" | "vobj", idA, targetA, idB, targetB, count: Number(count) };
  });
}

function pairingsFor(allowed: ReadonlySet<string>, pairings: readonly Pairing[]): string[] {
  return pairings
    .filter((p) => allowed.has(p.idA) && allowed.has(p.idB))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map((p) => (p.kind === "mod" ? `${p.targetA} + ${p.targetB}` : `${p.targetA} ... ${p.targetB}`));
}

function noteFor(entry: LexiconEntry): string | null {
  if (entry.pos !== "noun") return null;
  const notes = [
    isPlace(entry) && "place",
    isHuman(entry) && "person",
    !isHuman(entry) && isAnimate(entry) && "animal",
    isEdible(entry) && "edible",
  ].filter((n): n is string => !!n);
  return notes.length ? `${entry.target} (${notes.join(", ")})` : null;
}

// ---------------------------------------------------------------------------
// The brief itself
// ---------------------------------------------------------------------------

async function printBrief(
  slot: Slot,
  level: Level,
  entries: readonly LexiconEntry[],
  cumulativeIntroduced: ReadonlySet<string>,
  closedClassIds: ReadonlySet<string>,
  pairings: readonly Pairing[],
): Promise<void> {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const introduceEntries = slot.introduces.map((id) => byId.get(id)).filter((e): e is LexiconEntry => !!e);
  const reuseEntries = slot.reuses.map((id) => byId.get(id)).filter((e): e is LexiconEntry => !!e);
  const allowedIds = new Set<string>([...cumulativeIntroduced, ...closedClassIds, ...slot.introduces, ...slot.reuses]);

  const hints = (await Promise.all(introduceEntries.map(inflectionHint))).filter((h): h is string => !!h);
  const semanticNotes = [...introduceEntries, ...reuseEntries].map(noteFor).filter((n): n is string => !!n);
  const attested = pairingsFor(allowedIds, pairings);
  const [minS, maxS] = level.sentenceRange;

  console.log(`\n${"=".repeat(70)}`);
  console.log(`slot ${slot.seq}  [${slot.scene ?? "no scene - see PEDAGOGY §12's open gap"}]  ${level.id}`);
  console.log(`${"=".repeat(70)}`);
  console.log(`Sentences: ${minS}-${maxS}, ${level.sentenceLengthHint}, hard cap ${level.maxSentenceWords} words/sentence.`);
  console.log(`Grammar allowed: ${level.grammarAllowed.join("; ")}`);
  console.log(`\nMUST introduce (every one must appear):`);
  for (const e of introduceEntries) console.log(`  - ${e.target} (${e.glossEn}) [${e.id}]`);
  if (hints.length) {
    console.log(`\nInflected forms to use (do not invent your own):`);
    for (const h of hints) console.log(`  - ${h}`);
  }
  if (semanticNotes.length) console.log(`\nWhat these refer to: ${semanticNotes.join(", ")}`);
  console.log(`\nReuse where natural: ${reuseEntries.length ? reuseEntries.map((e) => e.target).join(", ") : "(none yet - early text)"}`);
  if (attested.length) console.log(`\nNatural combinations in this language: ${attested.join("; ")}`);
  console.log(`\nAllowed vocabulary (${allowedIds.size} words, any inflected form; closed classes always free):`);
  const allowedTargets = [...allowedIds].map((id) => byId.get(id)?.target).filter(Boolean);
  console.log(`  ${allowedTargets.join(profile.capabilities.transliteration ? "، " : ", ")}`);
  console.log(`\nWrite ONE ordinary, concrete situation - not history, war, mythology, or general statements about life.`);
}

describe("author-brief (offline, no model call)", () => {
  it(
    "prints a hand-authoring brief for unauthored schedule.ts slots",
    { timeout: 30_000 },
    async () => {
      const levelId = process.env.AUTHOR_LEVEL;
      expect(levelId, "set AUTHOR_LEVEL, e.g. AUTHOR_LEVEL=L1").toBeTruthy();

      const levelIndex = levels.findIndex((l) => l.id === levelId);
      expect(levelIndex, `no level "${levelId}" in levels.json`).toBeGreaterThanOrEqual(0);
      const level = levels[levelIndex];
      const previous = levelIndex > 0 ? levels[levelIndex - 1] : null;

      const schedule = scheduleFor(level, previous, lexicon.entries, isTeachable);
      const from = Number(process.env.AUTHOR_FROM ?? 1);
      const count = Number(process.env.AUTHOR_COUNT ?? 10);
      const window = schedule.filter((s) => s.seq >= from).slice(0, count);
      expect(window.length, `no schedule slots at or after seq ${from} for ${levelId}`).toBeGreaterThan(0);

      const closedClassIds = new Set(
        lexicon.entries.filter((e) => closedClassOf(e.id).length > 0).map((e) => e.id),
      );
      const pairings = loadPairings();

      // Seeded from every *prior level's* whole vocabulary, not just this
      // level's own new words - a real bug found while using this brief for
      // the first time: without it, an L2 author sees only ~20 abstract
      // L2-band words (estat, manera, importar...) and none of L1's ~500
      // concrete ones (casa, amic, menjar...) that a real L2 learner already
      // knows. "Write one concrete situation" is nearly unsatisfiable with
      // no concrete nouns at all - measured as the likely root cause of the
      // war/mythology drafts this pipeline produced before it was retired,
      // not (only) a weak topic instruction.
      const priorLevelIds = previous
        ? new Set(levelVocabulary(previous, lexicon.entries, isTeachable).map((e) => e.id))
        : new Set<string>();
      const cumulativeAt = new Map<number, Set<string>>();
      let running = new Set<string>(priorLevelIds);
      for (const s of schedule) {
        cumulativeAt.set(s.seq, new Set(running));
        running = new Set([...running, ...s.introduces]);
      }

      for (const slot of window) {
        await printBrief(slot, level, lexicon.entries, cumulativeAt.get(slot.seq) ?? new Set(), closedClassIds, pairings);
      }
      console.log(`\n${window.length} slot(s) briefed for ${profile.code} ${level.id}, from seq ${from}.`);
    },
  );
});
