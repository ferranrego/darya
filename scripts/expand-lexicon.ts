/**
 * Expand the lexicon using the HermitDave Persian frequency list and Groq API.
 * Falls back to OpenRouter if GROQ_API_KEY is not set.
 * 
 * Run: pnpm tsx scripts/expand-lexicon.ts
 */
import { readFileSync, appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

// We'll import the loader for the existing lexicon
import { lexiconFileSchema } from "../src/lib/content/schema.ts";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { normalizeDari, matchKey } from "../src/lib/text/normalize.ts";

const outPath = join(import.meta.dirname, "data", "core-lexicon-4.txt");
const lexiconJsonPath = join(import.meta.dirname, "..", "content", "lexicon", "lexicon.json");

// Define schema for structured output
const batchResponseSchema = z.object({
  entries: z.array(z.object({
    dari: z.string(),
    translit: z.string(),
    pos: z.enum(["noun", "verb", "adjective", "adverb", "pronoun", "preposition", "conjunction", "particle", "numeral", "interjection", "determiner", "phrase"]),
    register: z.enum(["neutral", "spoken", "formal", "literary"]),
    glossEn: z.string(),
    exampleDari: z.string(),
    exampleTranslit: z.string(),
    exampleEn: z.string(),
    tags: z.array(z.string()),
    variants: z.array(z.string())
  }))
});

async function callOpenAiCompatible(apiKey: string, baseUrl: string, model: string, prompt: string): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) throw new Error(`API error: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error("Empty response from API");
  return text;
}

async function main() {
  const groqKey = process.env.GROQ_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY;

  if (!groqKey && !openrouterKey) {
    console.error("GROQ_API_KEY or OPENROUTER_API_KEY must be set in your environment.");
    process.exit(1);
  }

  // Load known words
  console.log("Loading current lexicon...");
  const lexiconFileStr = readFileSync(lexiconJsonPath, "utf-8");
  const lexiconParsed = lexiconFileSchema.parse(JSON.parse(lexiconFileStr));
  
  const knownKeys = new Set<string>();
  let maxRank = 0;
  for (const entry of lexiconParsed.entries) {
    knownKeys.add(matchKey(entry.dari));
    for (const v of entry.variants) knownKeys.add(matchKey(v));
    if (entry.freqRank > maxRank) maxRank = entry.freqRank;
  }
  
  // To account for any already generated ones in core-lexicon-expanded.txt
  let nextRank = maxRank + 1;
  if (existsSync(outPath)) {
    const lines = readFileSync(outPath, "utf-8").split("\n");
    for (const line of lines) {
      if (!line.trim() || line.startsWith("#")) continue;
      const parts = line.split("|");
      if (parts.length > 1) {
        const rank = parseInt(parts[0], 10);
        if (!isNaN(rank) && rank >= nextRank) nextRank = rank + 1;
        knownKeys.add(matchKey(parts[1]));
        if (parts[10]) {
           for (const v of parts[10].split(",")) knownKeys.add(matchKey(v));
        }
      }
    }
  }

  // Download/load frequency list
  console.log("Fetching fa_50k.txt frequency list...");
  const freqRes = await fetch("https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fa/fa_50k.txt");
  if (!freqRes.ok) throw new Error("Failed to fetch frequency list");
  const freqText = await freqRes.text();
  
  const targetWords: string[] = [];
  const lines = freqText.split("\n");
  for (const line of lines) {
    const parts = line.trim().split(" ");
    if (parts.length < 2) continue;
    const word = parts[0];
    
    // Skip words with non-Persian chars, numbers, or very short punctuation-like things
    if (!word || word.length < 2 || /[0-9a-zA-Z]/.test(word)) continue;
    
    const key = matchKey(word);
    if (!knownKeys.has(key)) {
      targetWords.push(word);
      if (targetWords.length >= 10) break; // TEST BATCH OF 10
    }
  }

  console.log(`Targeting ${targetWords.length} new words...`, targetWords);

  if (targetWords.length === 0) return;

  const prompt = `You are a Dari linguist from Kabul. We are expanding a graded reader app's lexicon.
Here is a list of Persian words from a frequency list. Translate and adapt them into Kabuli Afghan Dari.
If an Iranian-specific word is used (e.g. دانشگاه), output the Dari equivalent instead (e.g. پوهنتون).
Provide the transliteration matching Kabuli pronunciation (e.g. use majhol vowels ē/ō, kh/gh/ch/sh/zh, ' for ayn/hamza, w for و).
Keep verbs as infinitives but put their most common present-tense conjugation in "variants".

Words to adapt:
${targetWords.join(" , ")}

Respond in strict JSON matching the schema below.
Schema:
{
  "entries": [
    {
      "dari": "string (the primary Dari word in Perso-Arabic script)",
      "translit": "string (Kabuli transliteration)",
      "pos": "noun|verb|adjective|adverb|pronoun|preposition|conjunction|particle|numeral|interjection|determiner|phrase",
      "register": "neutral|spoken|formal|literary",
      "glossEn": "string (short English meaning)",
      "exampleDari": "string (a very simple everyday sentence using the word)",
      "exampleTranslit": "string (transliteration of the example)",
      "exampleEn": "string (English translation of the example)",
      "tags": ["string (e.g. 'dari-specific', 'loanword')"],
      "variants": ["string (alternate spellings, or present-tense form for verbs)"]
    }
  ]
}
`;

  let rawText: string | undefined;

  if (groqKey) {
    console.log("Calling Groq API...");
    rawText = await callOpenAiCompatible(
      groqKey,
      "https://api.groq.com/openai/v1",
      process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      prompt
    );
  } else if (openrouterKey) {
    console.log("Calling OpenRouter API...");
    rawText = await callOpenAiCompatible(
      openrouterKey,
      "https://openrouter.ai/api/v1",
      process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct:free",
      prompt
    );
  }

  if (!rawText) throw new Error("No API response");

  const parsed = batchResponseSchema.parse(JSON.parse(rawText));
  
  if (!existsSync(outPath)) {
    appendFileSync(outPath, "# Darya core lexicon - expanded batch\n# rank|dari|translit|pos|register|glossEn|exampleDari|exampleTranslit|exampleEn|tags|variants\n");
  }

  let rank = nextRank;
  const linesOut = [];
  for (const entry of parsed.entries) {
    const parts = [
      rank++,
      entry.dari,
      entry.translit,
      entry.pos,
      entry.register,
      entry.glossEn,
      entry.exampleDari,
      entry.exampleTranslit,
      entry.exampleEn,
      entry.tags.join(","),
      entry.variants.join(",")
    ];
    linesOut.push(parts.join("|"));
  }

  appendFileSync(outPath, linesOut.join("\n") + "\n");
  console.log(`Appended ${linesOut.length} entries to ${outPath}`);
}

main().catch(console.error);
