import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { CONTENT_FORMAT_VERSION, type LexiconEntry, type Level, type TextDocument } from "../content/schema";
import { buildLexiconIndex } from "../text/lexicon-index";
import { lexicon } from "../content/load";
import { tokenizeDari } from "../text/normalize";
import { completeJson } from "./providers";

/**
 * AI text generation: one entry point over the shared free-tier provider
 * chain (see ./providers), strict validation, and a vocabulary verifier.
 * Callers cache results in Postgres, so this module never bills.
 */

const outputSchema = z.object({
  titleDari: z.string().min(1),
  titleTranslit: z.string().min(1),
  titleEn: z.string().min(1),
  sentences: z
    .array(
      z.object({
        dari: z.string().min(1),
        translit: z.string().min(1),
        en: z.string().min(1),
      }),
    )
    .min(2),
});

type RawText = z.infer<typeof outputSchema>;

export interface GenerationRequest {
  level: Level;
  /** Words the learner knows (dari + translit shown to the model). */
  knownWords: LexiconEntry[];
  /** New words the text should introduce. */
  targetWords: LexiconEntry[];
  newWordRatio: number;
}

/** Tokens that resolve to lexemes outside known+target, or not at all. */
const MAX_OOV_RATE = 0.14;

function buildPrompt(req: GenerationRequest): string {
  const known = req.knownWords.map((w) => `${w.dari} (${w.translit})`).join("، ");
  const target = req.targetWords
    .map((w) => `${w.dari} (${w.translit} = ${w.glossEn})`)
    .join("، ");
  const [minS, maxS] = req.level.sentenceRange;

  return `You are a Dari language teacher in Kabul writing a graded reader text in standard Afghan Dari (NOT Iranian Persian, use Dari vocabulary like مکتب، موتر، کلان and Kabuli usage).

Write a short, warm, concrete text (${minS}-${maxS} sentences, ${req.level.sentenceLengthHint}) about everyday Afghan life.

STRICT VOCABULARY CONSTRAINT:
- You may ONLY use these words the learner already knows (any inflection of them is fine): ${known}
- You MUST naturally weave in ALL of these new words: ${target}
- Do not use any other content words. Proper names of people are allowed sparingly.

Grammar allowed at this level: ${req.level.grammarAllowed.join("; ")}.

Transliteration rules: Latin, Kabuli pronunciation, long vowels ā ē ī ō ū, use kh/gh/ch/sh/zh/q/', w for و. Example: "می‌روم" → "mērawam".

Return ONLY JSON with this exact shape:
{"titleDari": "...", "titleTranslit": "...", "titleEn": "...", "sentences": [{"dari": "...", "translit": "...", "en": "..."}]}`;
}

// ---------------------------------------------------------------------------
// Verification + assembly
// ---------------------------------------------------------------------------

const index = buildLexiconIndex(lexicon.entries);

function assemble(raw: RawText, req: GenerationRequest, model: string): { doc: TextDocument; oovRate: number } {
  const allowed = new Set([...req.knownWords, ...req.targetWords].map((w) => w.id));
  const vocab = new Set<string>();
  let oov = 0;
  let total = 0;

  const sentences = raw.sentences.map((s) => {
    const tokens = tokenizeDari(s.dari).map((surface) => {
      total++;
      const entry = index.resolve(surface);
      if (entry) vocab.add(entry.id);
      if (!entry || !allowed.has(entry.id)) oov++;
      return { surface, lexemeId: entry?.id ?? null };
    });
    return { dari: s.dari, translit: s.translit, en: s.en, tokens };
  });

  const oovRate = total > 0 ? oov / total : 1;
  const hash = createHash("sha256")
    .update([...vocab].sort().join(","))
    .digest("hex")
    .slice(0, 16);

  return {
    doc: {
      id: `tx-gen-${hash}`,
      formatVersion: CONTENT_FORMAT_VERSION,
      level: req.level.id,
      titleDari: raw.titleDari,
      titleTranslit: raw.titleTranslit,
      titleEn: raw.titleEn,
      sentences,
      vocabUsed: [...vocab].sort(),
      newWordRatio: req.newWordRatio,
      source: "generated",
      model,
      createdAt: new Date().toISOString(),
    },
    oovRate,
  };
}

export function vocabHash(doc: TextDocument): string {
  return createHash("sha256").update(doc.vocabUsed.join(",")).digest("hex").slice(0, 16);
}

export async function generateText(req: GenerationRequest): Promise<TextDocument> {
  return completeJson(buildPrompt(req), {
    temperature: 0.8,
    validate: (raw, model) => {
      const parsed = outputSchema.parse(JSON.parse(raw));
      const { doc, oovRate } = assemble(parsed, req, model);
      if (oovRate > MAX_OOV_RATE) {
        throw new Error(`OOV rate ${(oovRate * 100).toFixed(0)}%`);
      }
      return doc;
    },
  });
}
