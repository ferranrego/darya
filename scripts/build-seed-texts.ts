/**
 * Tokenize seed text sources against the lexicon and write TextDocument JSON
 * files to content/texts/seed/. Fails if any word cannot be resolved - add the
 * word to the lexicon rather than weakening this check.
 *
 * Run: pnpm build:texts (after pnpm build:lexicon)
 */
import { mkdirSync, readFileSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONTENT_FORMAT_VERSION,
  lexiconFileSchema,
  textDocumentSchema,
  type TextDocument,
} from "../src/lib/content/schema.ts";
import { PROFILES } from "../src/lib/lang/index.ts";
import { contentRoot, targetLang } from "./content-path.ts";
import { readSpec } from "./verify-beginner-core.ts";
import type { SeedTextSource } from "./data/seed-text-source.ts";

const lang = targetLang();
const langProfile = PROFILES[lang as keyof typeof PROFILES];
if (!langProfile) throw new Error(`No language profile for "${lang}"`);
// The selected language's engine, not the environment's - see validate-content.
const { buildIndex, tokenize } = langProfile.text;

const { seedTexts } = (await import(`./data/seed-texts-${lang}.ts`)) as {
  seedTexts: SeedTextSource[];
};

const lexicon = lexiconFileSchema.parse(
  JSON.parse(readFileSync(join(contentRoot(), "lexicon", "lexicon.json"), "utf8")),
);
const index = buildIndex(lexicon.entries);

/**
 * Closed-class words - articles, pronouns, prepositions - are absorbed on
 * sight rather than taught (PEDAGOGY §5), so every level's `introduced` set
 * below starts with them instead of ever counting one as a `newWords` word.
 *
 * Read straight from `beginner-spec.json` via `contentRoot()`/`readSpec`, the
 * way `verify-beginner-core.ts` does - deliberately NOT `beginner-spec.ts`'s
 * `closedClassOf`, which resolves through `content/load.ts`'s `@content`
 * import. That alias points at the `content/active` symlink, fixed to
 * whichever language is active locally, and can silently disagree with this
 * script's own `--lang`/`NEXT_PUBLIC_TARGET_LANG` - the exact hazard
 * CLAUDE.md's "content/active is one shared symlink" warns about. A few
 * closed-class entries are multi-word ("چه وقت", "des de"); those resolve the
 * same way `beginner-spec.ts`'s own `resolveSpecWord` does - component by
 * component, only when every component resolves.
 */
function resolveClosedWord(word: string): string[] {
  const direct = index.resolve(word);
  if (direct) return [direct.id];
  const parts = word.split(/\s+/).filter(Boolean);
  if (parts.length < 2) return [];
  const resolved = parts.map((p) => index.resolve(p));
  if (resolved.some((e) => !e)) return [];
  return resolved.map((e) => e!.id);
}

const spec = readSpec(contentRoot());
const closedClassIds = new Set<string>();
if (spec) {
  for (const word of Object.values(spec.closedClasses).flat()) {
    for (const id of resolveClosedWord(word)) closedClassIds.add(id);
  }
}

const outDir = join(contentRoot(), "texts", "seed");
mkdirSync(outDir, { recursive: true });

const failures: string[] = [];
const docs: TextDocument[] = [];

// Curriculum order: within each level, texts are processed in ascending
// `seq`, and what one text introduces is measured against what came before it
// *at that level* - `newWords = vocabUsed \ introduced`, then unioned back in
// so the next text in the level sees it as known. `introduced` resets at the
// start of each level (seeded only with the closed classes above): a level's
// own texts are what teach its vocabulary, so a text's newWords should not
// depend on texts belonging to a different level.
// Two texts may not share a slug, and may not share a position in a level.
//
// The build writes one file per text, named from the slug, with no check that
// the name was free - so a duplicate slug silently overwrote the earlier text
// and the run still reported success. Measured when this guard was added:
// `l2-031` through `l2-034` were each authored twice, so four finished,
// reviewed texts (15 sentences) had never once reached a learner, and the
// shadowed text's `newWords` had already polluted the level's running
// `introduced` set on the way past. Nothing crashed and the output looked
// correct - the failure mode this whole file is built to make loud.
//
// This belongs here rather than in validate-content.ts: by the time the JSON
// exists on disk, the collision has already erased a file, so there is
// nothing left for a validator to find.
const seenSlugs = new Set<string>();
const seenPositions = new Set<string>();
for (const source of seedTexts) {
  if (seenSlugs.has(source.slug)) failures.push(`duplicate slug "${source.slug}"`);
  seenSlugs.add(source.slug);
  const position = `${source.level}#${source.seq}`;
  if (seenPositions.has(position)) {
    failures.push(`${source.slug}: duplicate curriculum position ${position}`);
  }
  seenPositions.add(position);
}

const byLevel = new Map<string, SeedTextSource[]>();
for (const source of seedTexts) {
  const list = byLevel.get(source.level) ?? [];
  list.push(source);
  byLevel.set(source.level, list);
}

for (const levelTexts of byLevel.values()) {
  const ordered = [...levelTexts].sort((a, b) => a.seq - b.seq);
  const introduced = new Set(closedClassIds);

  for (const source of ordered) {
    // A language that declares `transliteration` must actually carry it.
    //
    // The schema leaves the field optional because a Latin-script language has
    // nothing to transliterate, and for a long time nothing re-imposed it for
    // a language that does. The reader guards on the field and silently
    // renders nothing, so 273 of 400 beginner sentences shipped with no
    // pronunciation at all and no error anywhere - and with no audio in the
    // app, that line is the only pronunciation a learner ever gets. The gap
    // was growing, not shrinking, the whole time it went unchecked. All 400
    // are now written, so the backlog that carried the unwritten ones is gone
    // and this applies to every text without exception.
    if (langProfile.capabilities.transliteration) {
      if (!source.titleTranslit) failures.push(`${source.slug}: missing titleTranslit`);
      for (const s of source.sentences) {
        if (!s.translit) failures.push(`${source.slug}: missing translit for "${s.target}"`);
      }
    }

    const vocab = new Set<string>();
    const sentences = source.sentences.map((s) => {
      const tokens = tokenize(s.target).map((surface) => {
        const entry = index.resolve(surface);
        if (!entry) failures.push(`${source.slug}: unresolved word "${surface}" in "${s.target}"`);
        else vocab.add(entry.id);
        return { surface, lexemeId: entry?.id ?? null };
      });
      return { ...s, tokens };
    });

    const newWords = [...vocab].filter((id) => !introduced.has(id)).sort();
    for (const id of vocab) introduced.add(id);

    // A drafted text that quietly failed to use the words its schedule slot
    // assigned it would otherwise ship silently - this is the loud failure
    // instead. Existing seed texts predate the schedule and carry no
    // `introduces`, so this only fires for texts authored against a slot.
    if (source.introduces) {
      const declared = [...source.introduces].sort();
      if (declared.join(",") !== newWords.join(",")) {
        failures.push(
          `${source.slug}: declared introduces [${declared.join(", ")}] but computed newWords [${newWords.join(", ")}]`,
        );
      }
    }

    const doc: TextDocument = {
      id: `tx-seed-${source.slug}`,
      formatVersion: CONTENT_FORMAT_VERSION,
      level: source.level,
      titleTarget: source.titleTarget,
      titleTranslit: source.titleTranslit,
      titleEn: source.titleEn,
      sentences,
      vocabUsed: [...vocab].sort(),
      newWords,
      questions: source.questions ?? [],
      grammarPoints: source.grammarPoints ?? [],
      newWordRatio: 0,
      source: "seed",
      createdAt: "2026-07-20T00:00:00.000Z",
      seq: source.seq,
    };

    textDocumentSchema.parse(doc);
    docs.push(doc);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

for (const doc of docs) {
  writeFileSync(join(outDir, `${doc.id}.json`), JSON.stringify(doc, null, 2) + "\n");
}
// Report what was actually written, not what was read: the two differed
// silently for as long as duplicate slugs went unchecked.
/**
 * Remove built texts whose source entry is gone.
 *
 * This script only ever wrote files. A text renamed, re-levelled or deleted in
 * the source left its old JSON on disk, and every one of those is still a real
 * text as far as the app is concerned: it is loaded, offered to learners, and
 * counted by every content report. Twenty-one stale texts survived a
 * re-levelling this way, so the corpus held 131 files for 110 sources and the
 * validator dutifully checked all 131.
 *
 * Deleting is safe here in a way it is not for lexicon entries: `user_texts`
 * keys on the text id, so a removed text loses its reading history - which is
 * the same thing that happens when a text is renamed, and is the reason the
 * build refuses duplicate slugs rather than letting ids churn.
 */
const written = new Set(docs.map((d) => `${d.id}.json`));
let removed = 0;
for (const file of readdirSync(outDir)) {
  if (!file.endsWith(".json") || written.has(file)) continue;
  unlinkSync(join(outDir, file));
  removed++;
}

console.log(
  `wrote ${docs.length} seed texts to content/texts/seed/` +
    (removed > 0 ? `, removed ${removed} with no source entry` : ""),
);
