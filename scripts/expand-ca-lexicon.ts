/**
 * Expand the Catalan lexicon by semantic domain, verifying every candidate.
 *
 * Generation is the cheap part; the value here is the filter. A model asked for
 * "Catalan vocabulary" drifts into Spanish, invents infinitives, and writes
 * examples that do not contain the word it is illustrating. Every candidate is
 * therefore checked against the same Catalan engine the reader uses
 * (scripts/verify-ca-entries.ts), and anything that fails is dropped rather
 * than repaired - a wrong entry is worse than a missing one.
 *
 * Domains rather than "the next 500 frequent words": a model has no reliable
 * frequency ranking for Catalan, but it does know which words belong to
 * "kitchen" or "travel". Frequency bands are assigned afterwards by domain
 * tier, which we control.
 *
 * Run: node --env-file=.env.ca.local scripts/expand-ca-lexicon.ts [--limit N] [--dry-run]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { completeJson } from "../src/lib/ai/providers.ts";
import { ca } from "../src/lib/lang/ca/index.ts";
import { matchKey } from "../src/lib/lang/ca/normalize.ts";
import { verifyEntry, type CandidateEntry } from "./verify-ca-entries.ts";

const dryRun = process.argv.includes("--dry-run");
const limitFlag = process.argv.indexOf("--limit");
const limit = limitFlag !== -1 ? Number(process.argv[limitFlag + 1]) : Infinity;

const root = join(import.meta.dirname, "..");
const lexPath = join(root, "content", "ca", "lexicon", "lexicon.json");
const themes: { id: string }[] = JSON.parse(
  readFileSync(join(root, "content", "ca", "lexicon", "themes.json"), "utf8"),
);
const THEME_IDS = new Set(themes.map((t) => t.id));

/**
 * Domains in rough order of usefulness to a beginner. `tier` drives the
 * frequency band: tier 1 is A1 core, tier 2 rounds out A1, tier 3 is A2.
 */
const DOMAINS: { name: string; tier: 1 | 2 | 3; count: number; tags: string[] }[] = [
  { name: "family and people", tier: 1, count: 30, tags: ["Family & Relationships", "People & Identity"] },
  { name: "the house and furniture", tier: 1, count: 30, tags: ["Home & Furniture"] },
  { name: "food, drink and cooking", tier: 1, count: 35, tags: ["Food & Drink"] },
  { name: "the body and health", tier: 1, count: 30, tags: ["Body & Anatomy", "Health & Medicine"] },
  { name: "clothes and colours", tier: 1, count: 25, tags: ["Clothing & Fashion", "Colors & Shapes"] },
  { name: "numbers, time, days and months", tier: 1, count: 30, tags: ["Time & Calendar", "Numbers & Quantities"] },
  { name: "everyday verbs of daily routine", tier: 1, count: 35, tags: ["Actions & Movement"] },
  { name: "common adjectives describing people and things", tier: 1, count: 30, tags: ["Descriptions & Qualities"] },
  { name: "the town, shops and services", tier: 2, count: 30, tags: ["Geography & Places"] },
  { name: "school, study and work", tier: 2, count: 30, tags: ["Education & Learning", "Work & Business"] },
  { name: "travel and transport", tier: 2, count: 30, tags: ["Travel & Transportation"] },
  { name: "weather, nature and animals", tier: 2, count: 30, tags: ["Weather & Climate", "Animals & Pets"] },
  { name: "feelings and personality", tier: 2, count: 25, tags: ["Emotions & Feelings"] },
  { name: "verbs of communication and thinking", tier: 2, count: 30, tags: ["Communication & Media", "Actions & Movement"] },
  { name: "free time, sport and culture", tier: 2, count: 30, tags: ["Sports & Recreation", "Arts & Entertainment"] },
  { name: "technology and media", tier: 3, count: 25, tags: ["Science & Technology"] },
  { name: "money, shopping and quantities", tier: 3, count: 25, tags: ["Money & Finance", "Numbers & Quantities"] },
  { name: "abstract nouns for opinions and ideas", tier: 3, count: 25, tags: ["Abstract Concepts"] },
  { name: "connectors, adverbs and discourse markers", tier: 3, count: 30, tags: ["Grammar & Connectors"] },
  { name: "verbs for A2: change, effort, obligation", tier: 3, count: 30, tags: ["Actions & Movement"] },
];

const batchSchema = z.object({
  entries: z.array(
    z.object({
      word: z.string(),
      pos: z.string(),
      gloss: z.string(),
      example: z.string(),
      exampleEn: z.string(),
    }),
  ),
});

function buildPrompt(domain: string, count: number, avoid: string[]): string {
  return `You are ${ca.prompts.teacher} building a beginner's dictionary.
${ca.prompts.orthography}

List ${count} common Catalan words in the domain: ${domain}.

For each word give:
- "word": the dictionary form. Nouns singular; adjectives masculine singular;
  VERBS AS INFINITIVES ONLY (ending -ar, -er, -re or -ir). Never a conjugated form.
- "pos": one of noun, verb, adjective, adverb, pronoun, preposition, conjunction, numeral, interjection, determiner
- "gloss": a short English meaning
- "example": ONE natural Catalan sentence, 3 to 9 words, that CONTAINS this word
- "exampleEn": its English translation

HARD RULES:
- Catalan only. Never Spanish. If a word is identical in both, that is fine, but never use Spanish spelling (no ñ, no -ción; Catalan uses -ció).
- Everyday words a beginner meets. No technical or literary vocabulary.
- The example MUST contain the word (an inflected form is fine).
- Do not repeat any of these already-known words: ${avoid.slice(0, 120).join(", ")}

Return ONLY JSON: {"entries":[{"word":"...","pos":"...","gloss":"...","example":"...","exampleEn":"..."}]}`;
}

const file = JSON.parse(readFileSync(lexPath, "utf8"));
const existing: { target: string; freqRank: number }[] = file.entries;
const seenKeys = new Map<string, string>(
  existing.map((e) => [matchKey(e.target), e.target] as const),
);
let nextRank = Math.max(...existing.map((e) => e.freqRank)) + 1;

const bandOfTier = (t: 1 | 2 | 3) => (t === 1 ? 2 : t === 2 ? 3 : 4);
const accepted: Record<string, unknown>[] = [];
const rejected: string[] = [];

const domains = DOMAINS.slice(0, Number.isFinite(limit) ? limit : DOMAINS.length);
for (const d of domains) {
  if (dryRun) {
    console.log(`[dry-run] would request ${d.count} words for "${d.name}"`);
    continue;
  }
  try {
    const data = await completeJson(buildPrompt(d.name, d.count, [...seenKeys.values()]), {
      temperature: 0.3,
      validate: (raw) => batchSchema.parse(JSON.parse(raw)),
    });
    let kept = 0;
    for (const c of data.entries) {
      const candidate: CandidateEntry = {
        word: ca.text.normalize(c.word ?? ""),
        pos: (c.pos ?? "").trim(),
        gloss: (c.gloss ?? "").trim(),
        example: ca.text.normalize(c.example ?? ""),
        exampleEn: (c.exampleEn ?? "").trim(),
      };
      const problems = verifyEntry(candidate, seenKeys);
      if (problems.length) {
        rejected.push(`${candidate.word || "?"}: ${problems[0]}`);
        continue;
      }
      accepted.push({
        id: `lx-${String(nextRank).padStart(4, "0")}`,
        target: candidate.word,
        targetNormalized: candidate.word,
        glossEn: candidate.gloss,
        pos: candidate.pos,
        freqRank: nextRank,
        freqBand: bandOfTier(d.tier),
        register: "neutral",
        variants: [],
        exampleTarget: candidate.example,
        exampleEn: candidate.exampleEn,
        tags: d.tags.filter((t) => THEME_IDS.has(t)),
      });
      nextRank++;
      kept++;
    }
    console.log(`${d.name.padEnd(46)} ${kept}/${data.entries.length} kept`);
    // Groq's free tier is ~30 req/min; pace the batches so a long run does not
    // lose whole domains to a 429.
    await new Promise((r) => setTimeout(r, 3000));
  } catch (err) {
    console.error(`${d.name}: FAILED ${(err as Error).message.slice(0, 90)}`);
  }
}

console.log(`\naccepted ${accepted.length}, rejected ${rejected.length}`);
for (const r of rejected.slice(0, 15)) console.log(`  ✗ ${r}`);
if (rejected.length > 15) console.log(`  … and ${rejected.length - 15} more`);

if (!dryRun && accepted.length) {
  file.entries = [...existing, ...accepted];
  writeFileSync(lexPath, JSON.stringify(file, null, 2) + "\n");
  console.log(`\nWrote ${lexPath} (${file.entries.length} entries)`);
}
