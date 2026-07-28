import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { CONTENT_FORMAT_VERSION, type LexiconEntry, type Level, type TextDocument } from "../content/schema";
import { buildIndex } from "../text";
import { lexicon } from "../content/load";
import { tokenize } from "../text";
import { completeJson } from "./providers";
import { profile } from "../lang/index.ts";

/**
 * AI text generation: one entry point over the shared free-tier provider
 * chain (see ./providers), strict validation, and a vocabulary verifier.
 * Callers cache results in Postgres, so this module never bills.
 */

const outputSchema = z.object({
  titleTarget: z.string().min(1),
  titleTranslit: z.string().min(1),
  titleEn: z.string().min(1),
  sentences: z
    .array(
      z.object({
        target: z.string().min(1),
        translit: z.string().min(1),
        en: z.string().min(1),
      }),
    )
    .min(2),
});

type RawText = z.infer<typeof outputSchema>;

export interface GenerationRequest {
  level: Level;
  /** Words the learner knows (target + translit shown to the model). */
  knownWords: LexiconEntry[];
  /** New words the text should introduce. */
  targetWords: LexiconEntry[];
  newWordRatio: number;
  theme?: string;
}

/** Tokens that resolve to lexemes outside known+target, or not at all. */
const MAX_OOV_RATE = 0.25;

function buildPrompt(req: GenerationRequest): string {
  const known = req.knownWords.map((w) => `${w.target} (${w.translit})`).join("، ");
  const target = req.targetWords
    .map((w) => `${w.target} (${w.translit} = ${w.glossEn})`)
    .join("، ");
  const [minS, maxS] = req.level.sentenceRange;
  const themeInstructions = req.theme ? `\n- Set the text in this scenario/theme where it fits naturally: ${req.theme}` : "";

  return `You are ${profile.prompts.teacher} writing a graded reader text.
${profile.prompts.orthography}

Write a short, warm, concrete text (${minS}-${maxS} sentences, ${req.level.sentenceLengthHint}) about ${profile.prompts.culturalSetting}.
CRITICAL NARRATIVE RULES:
- The text must tell a coherent story or explain something clearly.
- Every sentence MUST be a logical continuation of the previous one. 
- Ensure a natural flow that makes sense to the reader; do NOT just write a list of disconnected sentences.${themeInstructions}

STRICT VOCABULARY CONSTRAINT:
- You may ONLY use these words the learner already knows (any inflection of them is fine): ${known}
- You MUST naturally weave in ALL of these new words: ${target}
- Do not use any other content words. Proper names of people are allowed sparingly.

Grammar allowed at this level: ${req.level.grammarAllowed.join("; ")}.


Return ONLY JSON with this exact shape:
{"titleTarget": "...", "titleTranslit": "...", "titleEn": "...", "sentences": [{"target": "...", "translit": "...", "en": "..."}]}`;
}

// ---------------------------------------------------------------------------
// Verification + assembly
// ---------------------------------------------------------------------------

const index = buildIndex(lexicon.entries);

function assemble(raw: RawText, req: GenerationRequest, model: string): { doc: TextDocument; oovRate: number } {
  const allowed = new Set([...req.knownWords, ...req.targetWords].map((w) => w.id));
  const vocab = new Set<string>();
  let oov = 0;
  let total = 0;

  const sentences = raw.sentences.map((s) => {
    const tokens = tokenize(s.target).map((surface) => {
      total++;
      const entry = index.resolve(surface);
      if (entry) vocab.add(entry.id);
      if (!entry || !allowed.has(entry.id)) oov++;
      
      return { surface, lexemeId: entry?.id ?? null };
    });
    return { target: s.target, translit: s.translit, en: s.en, tokens };
  });

  const oovRate = total > 0 ? oov / total : 1;
  const hash = createHash("sha256")
    .update([...vocab].sort().join(","))
    .digest("hex")
    .slice(0, 16);

  return {
    doc: {
      id: `tx-gen-${hash}-${randomUUID().slice(0, 8)}`,
      formatVersion: CONTENT_FORMAT_VERSION,
      level: req.level.id,
      titleTarget: raw.titleTarget,
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

export async function repairText(
  doc: TextDocument,
  req: GenerationRequest,
  strict = true
): Promise<TextDocument> {
  const allowed = new Set([...req.knownWords, ...req.targetWords].map((w) => w.id));
  
  const badSentenceIndices: number[] = [];
  doc.sentences.forEach((s, idx) => {
    const hasOov = s.tokens.some((t) => !t.lexemeId || !allowed.has(t.lexemeId));
    if (hasOov) badSentenceIndices.push(idx);
  });
  
  if (badSentenceIndices.length === 0) return doc;
  
  const known = req.knownWords.map((w) => `${w.target} (${w.translit})`).join("، ");
  const target = req.targetWords.map((w) => `${w.target} (${w.translit} = ${w.glossEn})`).join("، ");
  
  const badSentencesText = badSentenceIndices.map(i => `${i}: ${doc.sentences[i].target}`).join('\n');
  
  const repairPrompt = `You are ${profile.prompts.teacher}. The following sentences have vocabulary that is too difficult for the student.
Rewrite ONLY these specific sentences using ONLY allowed words. Keep the meaning as close to the original as possible.

ALLOWED WORDS:
${known}
${target}

SENTENCES TO REPAIR:
${badSentencesText}

Return JSON strictly in this format:
{"repairs": [{"index": 0, "target": "...", "translit": "...", "en": "..."}]}
where "index" is the number provided above for the sentence.`;

  const repairSchema = z.object({
    repairs: z.array(z.object({
      index: z.number(),
      target: z.string(),
      translit: z.string(),
      en: z.string()
    }))
  });

  const repairs = await completeJson(repairPrompt, {
    temperature: 0.2,
    validate: (raw) => repairSchema.parse(JSON.parse(raw)).repairs
  });
  
  const raw: RawText = {
    titleTarget: doc.titleTarget,
    titleTranslit: doc.titleTranslit,
    titleEn: doc.titleEn,
    sentences: doc.sentences.map((s, i) => {
      const repair = repairs.find(r => r.index === i);
      return repair ? { target: repair.target, translit: repair.translit, en: repair.en } : { target: s.target, translit: s.translit, en: s.en };
    })
  };
  
  const { doc: finalDoc, oovRate } = assemble(raw, req, doc.model ?? "unknown-repair");
  if (strict && oovRate > MAX_OOV_RATE) {
    throw new Error(`Repair failed: OOV rate still ${(oovRate * 100).toFixed(0)}%`);
  }
  return finalDoc;
}

export async function generateText(req: GenerationRequest): Promise<TextDocument> {
  let lastError: unknown;
  
  // Try up to 3 times to get a good text (including repairs)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await completeJson(buildPrompt(req), {
        temperature: 0.8,
        validate: (raw, model) => {
          const parsed = outputSchema.parse(JSON.parse(raw));
          return assemble(parsed, req, model);
        },
      });
      
      if (result.oovRate <= MAX_OOV_RATE) {
        return result.doc;
      }
      
      // Attempt repair
      try {
        const strict = attempt < 2; // Strict on attempts 0 and 1, lenient on attempt 2
        return await repairText(result.doc, req, strict);
      } catch (repairError) {
        // If repair fails, we throw to trigger the outer generation retry
        throw new Error(`Repair failed: ${repairError instanceof Error ? repairError.message : String(repairError)}`);
      }
    } catch (e) {
      lastError = e;
      console.warn(`Generation attempt ${attempt + 1} failed:`, e);
    }
  }
  
  throw lastError;
}
