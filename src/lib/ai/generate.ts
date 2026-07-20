import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { CONTENT_FORMAT_VERSION, type LexiconEntry, type Level, type TextDocument } from "../content/schema";
import { buildLexiconIndex } from "../text/lexicon-index";
import { lexicon } from "../content/load";
import { tokenizeDari } from "../text/normalize";

/**
 * AI text generation: one entry point, an ordered free-tier provider chain
 * (Gemini → Groq → OpenRouter), strict validation, and a vocabulary
 * verifier. Callers cache results in Postgres — this module never bills.
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
    .map((w) => `${w.dari} (${w.translit} — ${w.glossEn})`)
    .join("، ");
  const [minS, maxS] = req.level.sentenceRange;

  return `You are a Dari language teacher in Kabul writing a graded reader text in standard Afghan Dari (NOT Iranian Persian — use Dari vocabulary like مکتب، موتر، کلان and Kabuli usage).

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
// Providers
// ---------------------------------------------------------------------------

interface Provider {
  name: string;
  available: () => boolean;
  call: (prompt: string) => Promise<string>;
}

const gemini: Provider = {
  name: "gemini",
  available: () => !!process.env.GEMINI_API_KEY,
  async call(prompt) {
    const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEMINI_API_KEY!,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json", temperature: 0.8 },
        }),
      },
    );
    if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("gemini: empty response");
    return text;
  },
};

function openAiCompatible(name: string, baseUrl: string, keyEnv: string, modelEnv: string, defaultModel: string): Provider {
  return {
    name,
    available: () => !!process.env[keyEnv],
    async call(prompt) {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env[keyEnv]}`,
        },
        body: JSON.stringify({
          model: process.env[modelEnv] ?? defaultModel,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.8,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok) throw new Error(`${name} ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content;
      if (!text) throw new Error(`${name}: empty response`);
      return text;
    },
  };
}

const providers: Provider[] = [
  gemini,
  openAiCompatible("groq", "https://api.groq.com/openai/v1", "GROQ_API_KEY", "GROQ_MODEL", "llama-3.3-70b-versatile"),
  openAiCompatible("openrouter", "https://openrouter.ai/api/v1", "OPENROUTER_API_KEY", "OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct:free"),
];

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
  const prompt = buildPrompt(req);
  const errors: string[] = [];

  for (const provider of providers) {
    if (!provider.available()) continue;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const rawText = await provider.call(prompt);
        const parsed = outputSchema.parse(JSON.parse(rawText));
        const { doc, oovRate } = assemble(parsed, req, provider.name);
        if (oovRate > MAX_OOV_RATE) {
          errors.push(`${provider.name}#${attempt}: OOV rate ${(oovRate * 100).toFixed(0)}%`);
          continue;
        }
        return doc;
      } catch (e) {
        errors.push(`${provider.name}#${attempt}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }
  throw new Error(`All providers failed: ${errors.join(" | ")}`);
}
